from fastapi.testclient import TestClient
import pytest

import server
from darkpool.command_service import (
    build_alerts_summary,
    build_confluence_summary,
    build_darkpool_summary,
    build_levels_summary,
    build_watchlist_summary,
)
from darkpool.discord_formatting import summary_to_embed
from darkpool.subscriptions import SubscriptionStore


@pytest.mark.asyncio
async def test_command_service_builds_darkpool_summary():
    summary = await build_darkpool_summary("AAPL", provider="demo")

    assert summary.symbol == "AAPL"
    assert summary.sections
    assert summary.metrics["provider"] == "demo"
    assert any(section.title == "Top Levels" for section in summary.sections)


@pytest.mark.asyncio
async def test_command_service_builds_specific_feature_summaries():
    levels = await build_levels_summary("NVDA", provider="demo")
    confluence = await build_confluence_summary("NVDA", provider="demo")
    alerts = await build_alerts_summary("NVDA", provider="demo")

    assert levels.command == "levels"
    assert confluence.command == "confluence"
    assert alerts.command == "alerts"
    assert alerts.sections[0].items


@pytest.mark.asyncio
async def test_watchlist_summary_aggregates_multiple_symbols():
    summary = await build_watchlist_summary(["AAPL", "NVDA", "MSFT"], provider="demo")

    assert summary.command == "watchlist"
    assert summary.metrics["symbols"] == "AAPL,NVDA,MSFT"
    assert len(summary.sections[0].items) == 3


@pytest.mark.asyncio
async def test_summary_to_embed_payload_is_discord_ready():
    summary = await build_levels_summary("AAPL", provider="demo")
    payload = summary_to_embed(summary)

    assert payload["title"].startswith("AAPL")
    assert payload["fields"]
    assert payload["footer"]["text"]


def test_subscription_store_creates_lists_and_deletes_topics():
    store = SubscriptionStore()
    subscription = store.create(channel_id="channel-1", topic="alerts", symbols=["AAPL", "NVDA"], min_score=70)

    assert subscription.id
    assert store.list(channel_id="channel-1") == [subscription]
    assert store.delete(subscription.id, channel_id="channel-1") is True
    assert store.list(channel_id="channel-1") == []


def test_subscription_api_routes():
    client = TestClient(server.app)
    create_response = client.post(
        "/discord/subscriptions",
        params={"channel_id": "test-channel", "topic": "alerts", "symbols": "AAPL,NVDA", "min_score": 72},
    )
    assert create_response.status_code == 200, create_response.text
    sub_id = create_response.json()["subscription"]["id"]

    list_response = client.get("/discord/subscriptions", params={"channel_id": "test-channel"})
    assert list_response.status_code == 200
    assert len(list_response.json()["subscriptions"]) == 1

    delete_response = client.delete(f"/discord/subscriptions/{sub_id}", params={"channel_id": "test-channel"})
    assert delete_response.status_code == 200
    assert delete_response.json()["deleted"] is True
