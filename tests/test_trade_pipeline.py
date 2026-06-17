import pytest

from darkpool.trade_intent import SentinelConfirmation, TradingPreferences


@pytest.mark.asyncio
async def test_trade_pipeline_prepares_pulse_only_after_sentinel_approval():
    from darkpool.trade_pipeline import build_trade_intent_report

    report = await build_trade_intent_report(
        symbol="AAPL",
        provider="demo",
        preferences=TradingPreferences(min_score=60, max_distance_pct=2, min_notional=1_000_000),
        confirmation=SentinelConfirmation(
            price_confirmed=True,
            liquidity_confirmed=True,
            news_checked=True,
            observed_spread_bps=5,
            max_spread_bps=25,
        ),
        include_pulse_packet=True,
    )

    assert report.intent is not None
    assert report.sentinel is not None
    assert report.sentinel.status == "approved"
    assert report.pulse_packet is not None
    assert report.pulse_packet["requires_manual_execution"] is True


@pytest.mark.asyncio
async def test_trade_pipeline_withholds_pulse_when_sentinel_rejects():
    from darkpool.trade_pipeline import build_trade_intent_report

    report = await build_trade_intent_report(
        symbol="AAPL",
        provider="demo",
        preferences=TradingPreferences(min_score=60, max_distance_pct=2, min_notional=1_000_000),
        confirmation=SentinelConfirmation(price_confirmed=False, liquidity_confirmed=True, news_checked=True),
        include_pulse_packet=True,
    )

    assert report.intent is not None
    assert report.sentinel is not None
    assert report.sentinel.status == "rejected"
    assert report.pulse_packet is None
