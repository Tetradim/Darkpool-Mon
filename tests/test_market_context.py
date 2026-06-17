import pytest

from darkpool.providers import ProviderError


@pytest.mark.asyncio
async def test_market_context_uses_requested_provider_for_levels_and_scores():
    from darkpool.market_context import build_market_context

    context = await build_market_context("AAPL", provider="demo", limit=50)

    assert context.symbol == "AAPL"
    assert context.provider_result.provider == "demo"
    assert context.prints
    assert context.levels
    assert context.scores
    assert context.alerts
    assert context.confirmation_plan.available_confirmation_weight == 0.0


@pytest.mark.asyncio
async def test_market_context_rejects_unknown_provider():
    from darkpool.market_context import build_market_context

    with pytest.raises(ProviderError, match="Unsupported provider"):
        await build_market_context("AAPL", provider="missing-provider", limit=20)


def test_trade_intent_route_uses_market_context_source_score():
    from fastapi.testclient import TestClient

    import server

    client = TestClient(server.app)
    response = client.get("/darkpool/trade-intent?symbol=AAPL&provider=demo&min_score=60&max_distance_pct=2")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source_score"]["symbol"] == "AAPL"
    assert body["intent"]["confidence"] == body["source_score"]["score"]
    assert body["intent"]["source_confirmation_weight"] == body["confirmation_sources"]["available_confirmation_weight"]
