import os
import subprocess
import sys

import pytest
from fastapi.testclient import TestClient

import server
from darkpool.providers import ProviderError, fetch_provider_result


@pytest.mark.asyncio
async def test_demo_provider_returns_prints_for_symbol():
    result = await fetch_provider_result("AAPL", provider="demo", limit=20)

    assert result.provider == "demo"
    assert result.prints
    assert all(print_.symbol == "AAPL" for print_ in result.prints)


@pytest.mark.asyncio
async def test_unknown_provider_raises_provider_error():
    with pytest.raises(ProviderError):
        await fetch_provider_result("AAPL", provider="missing")


@pytest.mark.asyncio
async def test_command_summary_rejects_unknown_provider_instead_of_labeling_demo_data():
    from darkpool.command_service import build_levels_summary

    with pytest.raises(ProviderError, match="Unsupported provider"):
        await build_levels_summary("AAPL", provider="missing-provider")


def test_api_compatibility_routes_return_data():
    client = TestClient(server.app)

    response = client.get("/api/full?symbol=AAPL&provider=demo&limit=10")
    assert response.status_code == 200, response.text
    assert response.json()["count"] > 0

    response = client.get("/api/aggregate/AAPL?provider=demo")
    assert response.status_code == 200, response.text
    assert response.json()["symbol"] == "AAPL"

    response = client.get("/api/sentiment?provider=demo")
    assert response.status_code == 200, response.text
    assert "sentiment" in response.json()


def test_provider_catalog_marks_execution_capabilities_clearly():
    client = TestClient(server.app)

    response = client.get("/providers")
    assert response.status_code == 200, response.text

    providers = {provider["id"]: provider for provider in response.json()}
    assert providers["demo"] == {
        "id": "demo",
        "label": "Demo Tape",
        "runnable": True,
        "requires_api_key": False,
        "has_api_key": False,
        "status": "ready",
        "message": "Offline deterministic data for local dashboards and tests.",
    }
    assert providers["finra"]["runnable"] is True
    assert providers["finra"]["status"] == "ready"
    assert providers["polygon"]["runnable"] is False
    assert providers["polygon"]["requires_api_key"] is True
    assert providers["polygon"]["status"] == "not_implemented"
    assert providers["intrinio"]["runnable"] is False
    assert providers["intrinio"]["requires_api_key"] is True
    assert providers["intrinio"]["status"] == "not_implemented"


@pytest.mark.asyncio
async def test_provider_catalog_runnable_entries_match_fetcher_support():
    client = TestClient(server.app)
    providers = client.get("/providers").json()

    for provider in providers:
        if provider["runnable"]:
            result = await fetch_provider_result("AAPL", provider=provider["id"], limit=5)
            assert result.prints
        else:
            with pytest.raises(ProviderError, match="not available for execution|Unsupported provider"):
                await fetch_provider_result("AAPL", provider=provider["id"], limit=5)


def test_legacy_otc_route_rejects_unavailable_provider_before_network(monkeypatch):
    import routes.darkpool_routes as darkpool_routes

    async def fail_if_called(symbol):
        raise AssertionError("external provider adapter should not run")

    monkeypatch.setenv("POLYGON_API_KEY", "configured-but-not-wired")
    monkeypatch.setattr(darkpool_routes, "_fetch_polygon_otc_data", fail_if_called)

    client = TestClient(server.app)
    response = client.get("/darkpool/otc?symbol=AAPL&provider=polygon")

    assert response.status_code == 400, response.text
    assert "not available for execution" in response.text


def test_discord_unknown_command_payload_is_handled(monkeypatch):
    monkeypatch.setenv("ALLOW_UNSIGNED_DISCORD_INTERACTIONS", "true")
    client = TestClient(server.app)
    response = client.post(
        "/discord/commands",
        json={"id": "1", "type": 2, "data": {"name": "unknown"}, "member": None, "guild_id": None, "channel_id": None},
    )

    assert response.status_code == 200
    assert response.json()["data"]["content"] == "Unknown command"


def test_discord_interaction_levels_command_returns_embed(monkeypatch):
    monkeypatch.setenv("ALLOW_UNSIGNED_DISCORD_INTERACTIONS", "true")
    client = TestClient(server.app)
    response = client.post(
        "/discord/commands",
        json={
            "id": "2",
            "type": 2,
            "data": {
                "name": "levels",
                "options": [
                    {"name": "symbol", "value": "AAPL"},
                    {"name": "provider", "value": "demo"},
                ],
            },
            "member": None,
            "guild_id": "guild-1",
            "channel_id": "channel-1",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == 4
    assert body["data"]["embeds"][0]["title"].startswith("AAPL")


def test_discord_watchlist_summary_returns_provider_error_as_bad_request():
    client = TestClient(server.app, raise_server_exceptions=False)
    response = client.get(
        "/discord/watchlist-summary",
        params={"symbols": "AAPL,NVDA", "provider": "polygon"},
    )

    assert response.status_code == 400
    assert "not available for execution" in response.json()["detail"]


def test_discord_interaction_provider_error_returns_ephemeral_message(monkeypatch):
    monkeypatch.setenv("ALLOW_UNSIGNED_DISCORD_INTERACTIONS", "true")
    client = TestClient(server.app, raise_server_exceptions=False)
    response = client.post(
        "/discord/commands",
        json={
            "id": "provider-error",
            "type": 2,
            "data": {
                "name": "levels",
                "options": [
                    {"name": "symbol", "value": "AAPL"},
                    {"name": "provider", "value": "polygon"},
                ],
            },
            "member": None,
            "guild_id": "guild-1",
            "channel_id": "channel-1",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == 4
    assert body["data"]["flags"] == 64
    assert "not available for execution" in body["data"]["content"]


def test_discord_interaction_subscribe_command_creates_subscription(monkeypatch):
    monkeypatch.setenv("ALLOW_UNSIGNED_DISCORD_INTERACTIONS", "true")
    client = TestClient(server.app)
    response = client.post(
        "/discord/commands",
        json={
            "id": "3",
            "type": 2,
            "data": {
                "name": "subscribe",
                "options": [
                    {"name": "topic", "value": "alerts"},
                    {"name": "symbols", "value": "AAPL,NVDA"},
                    {"name": "min_score", "value": 75},
                ],
            },
            "member": None,
            "guild_id": "guild-1",
            "channel_id": "channel-slash",
        },
    )

    assert response.status_code == 200
    assert "Subscribed channel" in response.json()["data"]["content"]


def test_discord_bot_no_token_exits_cleanly():
    env = os.environ.copy()
    env["PYTHON_DOTENV_DISABLED"] = "1"
    env["DISCORD_BOT_TOKEN"] = ""
    env["DISCORD_GUILD_ID"] = ""

    result = subprocess.run(
        [sys.executable, "-u", "discord_bot.py"],
        cwd=os.getcwd(),
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )

    assert result.returncode == 0
    assert "DISCORD_BOT_TOKEN not set" in result.stdout
