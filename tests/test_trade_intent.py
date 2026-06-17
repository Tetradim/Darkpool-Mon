from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import server
from darkpool.models import ConfluenceScore, DarkpoolLevel
from darkpool.trade_intent import (
    LocalSentinelEdgeAdapter,
    SentinelConfirmation,
    TradingPreferences,
    build_trade_intent,
    prepare_pulse_packet,
)


def _level(strength: float = 92.0, notional: float = 120_000_000, side_bias: str = "BUY") -> DarkpoolLevel:
    now = datetime.now(timezone.utc)
    return DarkpoolLevel(
        symbol="AAPL",
        price=180.0,
        total_size=650_000,
        notional=notional,
        print_count=5,
        first_seen=now,
        last_seen=now,
        venues=["ATS", "TRF"],
        strength_score=strength,
        side_bias=side_bias,
        freshness_minutes=8,
    )


def _score(
    score: float = 91.0,
    direction: str = "BULLISH",
    distance_pct: float = 0.35,
    level: DarkpoolLevel | None = None,
) -> ConfluenceScore:
    return ConfluenceScore(
        symbol="AAPL",
        level_price=180.0,
        spot_price=179.4,
        score=score,
        direction=direction,
        distance_pct=distance_pct,
        level=level or _level(),
        exposure_nodes=[],
        options_flow=[],
        reasons=["dark pool cluster strength 92.0", "fresh level", "options flow confirmation present"],
    )


def test_trade_intent_blocks_when_user_thresholds_are_not_met():
    preferences = TradingPreferences(min_score=92, max_distance_pct=0.25, min_notional=200_000_000)

    intent = build_trade_intent(_score(score=88.0, distance_pct=0.6), preferences)

    assert intent.status == "blocked"
    assert intent.action == "HOLD"
    assert intent.confidence == 88.0
    assert any("below user minimum score" in blocker for blocker in intent.blockers)
    assert any("farther than allowed" in blocker for blocker in intent.blockers)
    assert any("below user minimum notional" in blocker for blocker in intent.blockers)
    assert intent.readable_summary.startswith("AAPL blocked")


def test_sentinel_approval_is_required_before_pulse_packet_exists():
    preferences = TradingPreferences(
        min_score=80,
        max_distance_pct=1.0,
        min_notional=50_000_000,
        max_risk_dollars=500,
        stop_distance_pct=1.0,
        reward_risk_ratio=2.0,
        max_position_notional=100_000,
    )
    intent = build_trade_intent(_score(), preferences)
    confirmation = SentinelConfirmation(
        price_confirmed=True,
        liquidity_confirmed=True,
        news_checked=True,
        observed_spread_bps=6,
        max_spread_bps=25,
    )
    sentinel = LocalSentinelEdgeAdapter().review(intent, confirmation)

    assert intent.status == "ready_for_sentinel"
    assert intent.action == "BUY"
    assert intent.risk_plan is not None
    assert intent.risk_plan.stop_price == 178.2
    assert intent.risk_plan.target_price == 183.6
    assert intent.risk_plan.position_notional <= 100_000
    assert sentinel.status == "approved"
    packet = prepare_pulse_packet(intent, sentinel)
    assert packet["destination"] == "pulse"
    assert packet["action"] == "BUY"
    assert packet["requires_manual_execution"] is True
    assert packet["sentinel_decision_id"] == sentinel.decision_id
    assert packet["risk_plan"]["max_risk_dollars"] == 500.0
    assert packet["risk_plan"]["reward_risk_ratio"] == 2.0
    assert packet["sentinel_confirmation"]["price_confirmed"] is True


def test_sentinel_rejects_ready_intent_without_required_confirmations():
    preferences = TradingPreferences(min_score=80, max_distance_pct=1.0, min_notional=50_000_000)
    intent = build_trade_intent(_score(), preferences)
    confirmation = SentinelConfirmation(
        price_confirmed=False,
        liquidity_confirmed=True,
        news_checked=True,
        observed_spread_bps=4,
        max_spread_bps=20,
    )

    sentinel = LocalSentinelEdgeAdapter().review(intent, confirmation)

    assert intent.status == "ready_for_sentinel"
    assert sentinel.status == "rejected"
    assert any("price confirmation" in reason for reason in sentinel.reasons)
    with pytest.raises(ValueError, match="Sentinel Edge approval is required"):
        prepare_pulse_packet(intent, sentinel)


def test_sentinel_rejects_when_observed_spread_is_too_wide():
    preferences = TradingPreferences(min_score=80, max_distance_pct=1.0, min_notional=50_000_000)
    intent = build_trade_intent(_score(), preferences)
    confirmation = SentinelConfirmation(
        price_confirmed=True,
        liquidity_confirmed=True,
        news_checked=True,
        observed_spread_bps=35,
        max_spread_bps=20,
    )

    sentinel = LocalSentinelEdgeAdapter().review(intent, confirmation)

    assert sentinel.status == "rejected"
    assert any("spread" in reason for reason in sentinel.reasons)


def test_trade_intent_blocks_when_risk_controls_are_invalid():
    preferences = TradingPreferences(
        min_score=80,
        max_distance_pct=1.0,
        min_notional=50_000_000,
        max_risk_dollars=0,
        stop_distance_pct=0,
    )

    intent = build_trade_intent(_score(), preferences)
    sentinel = LocalSentinelEdgeAdapter().review(
        intent,
        SentinelConfirmation(price_confirmed=True, liquidity_confirmed=True, news_checked=True),
    )

    assert intent.status == "blocked"
    assert intent.action == "HOLD"
    assert intent.risk_plan is None
    assert sentinel.status == "rejected"
    assert any("risk budget" in blocker for blocker in intent.blockers)
    assert any("stop distance" in blocker for blocker in intent.blockers)


def test_pulse_packet_rejects_missing_or_failed_sentinel_confirmation():
    preferences = TradingPreferences(min_score=80, max_distance_pct=1.0, min_notional=50_000_000)
    intent = build_trade_intent(_score(score=79.0), preferences)
    sentinel = LocalSentinelEdgeAdapter().review(intent)

    assert sentinel.status == "rejected"
    with pytest.raises(ValueError, match="Sentinel Edge approval is required"):
        prepare_pulse_packet(intent, sentinel)


def test_trade_intent_endpoint_exposes_customizable_gate_and_pulse_packet():
    client = TestClient(server.app)

    response = client.get(
        "/darkpool/trade-intent?symbol=AAPL&provider=demo&min_score=60"
        "&max_distance_pct=2.0&min_notional=1000000&include_pulse_packet=true"
        "&max_risk_dollars=750&stop_distance_pct=1.2&reward_risk_ratio=2.5&max_position_notional=40000"
        "&price_confirmed=true&liquidity_confirmed=true&news_checked=true&observed_spread_bps=5&max_spread_bps=20"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["symbol"] == "AAPL"
    assert body["preferences"]["min_score"] == 60.0
    assert body["intent"]["status"] in {"ready_for_sentinel", "blocked"}
    assert "readable_summary" in body["intent"]
    if body["sentinel"]["status"] == "approved":
        assert body["pulse_packet"]["destination"] == "pulse"
        assert body["pulse_packet"]["requires_manual_execution"] is True
        assert body["intent"]["risk_plan"]["max_risk_dollars"] == 750.0
        assert body["pulse_packet"]["risk_plan"]["max_position_notional"] == 40000.0
        assert body["sentinel"]["confirmation"]["observed_spread_bps"] == 5.0
    else:
        assert body["pulse_packet"] is None


def test_trade_intent_endpoint_withholds_pulse_until_confirmation_is_complete():
    client = TestClient(server.app)

    response = client.get(
        "/darkpool/trade-intent?symbol=AAPL&provider=demo&min_score=60"
        "&max_distance_pct=2.0&min_notional=1000000&include_pulse_packet=true"
        "&price_confirmed=false&liquidity_confirmed=true&news_checked=true"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sentinel"]["status"] == "rejected"
    assert body["pulse_packet"] is None
    assert any("price confirmation" in reason for reason in body["sentinel"]["reasons"])
