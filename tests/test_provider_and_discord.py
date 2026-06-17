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


def test_discord_unknown_command_payload_is_handled():
    client = TestClient(server.app)
    response = client.post(
        "/discord/commands",
        json={"id": "1", "type": 2, "data": {"name": "unknown"}, "member": None, "guild_id": None, "channel_id": None},
    )

    assert response.status_code == 200
    assert response.json()["data"]["content"] == "Unknown command"


def test_discord_interaction_levels_command_returns_embed():
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


def test_discord_interaction_subscribe_command_creates_subscription():
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
