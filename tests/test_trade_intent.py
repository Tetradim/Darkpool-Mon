from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

import server
from darkpool.models import ConfluenceScore, DarkpoolLevel, ExposureNode, OptionsFlowSignal
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
    exposure_nodes: list[ExposureNode] | None = None,
    options_flow: list[OptionsFlowSignal] | None = None,
) -> ConfluenceScore:
    return ConfluenceScore(
        symbol="AAPL",
        level_price=180.0,
        spot_price=179.4,
        score=score,
        direction=direction,
        distance_pct=distance_pct,
        level=level or _level(),
        exposure_nodes=exposure_nodes or [],
        options_flow=options_flow or [],
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


def test_trade_intent_includes_confidence_breakdown_for_operator_readability():
    node = ExposureNode(
        symbol="AAPL",
        price=180.1,
        exposure=1_500_000,
        kind="GEX",
        expires_at=None,
        updated_at=datetime.now(timezone.utc),
    )
    flow = OptionsFlowSignal(symbol="AAPL", direction="BULLISH", premium=1_400_000, contracts=250)
    intent = build_trade_intent(
        _score(score=80.0, exposure_nodes=[node], options_flow=[flow]),
        TradingPreferences(min_score=80, max_distance_pct=1.0, min_notional=50_000_000),
    )

    names = [component.name for component in intent.confidence_breakdown]
    assert "Dark pool level" in names
    assert "Price proximity" in names
    assert "Exposure alignment" in names
    assert "Options flow" in names
    assert sum(component.contribution for component in intent.confidence_breakdown) >= intent.confidence
    assert all(component.explanation for component in intent.confidence_breakdown)


def test_trade_intent_exposes_source_adjusted_confidence_without_overwriting_raw_score():
    intent = build_trade_intent(
        _score(score=82.0),
        TradingPreferences(min_score=80, max_distance_pct=1.0, min_notional=50_000_000),
        source_confirmation_weight=0.35,
    )

    assert intent.confidence == 82.0
    assert intent.source_confirmation_weight == 0.35
    assert intent.source_adjusted_confidence == 28.7


def test_trade_intent_caps_source_confirmation_weight_for_operator_readability():
    intent = build_trade_intent(
        _score(score=82.0),
        TradingPreferences(min_score=80, max_distance_pct=1.0, min_notional=50_000_000),
        source_confirmation_weight=1.15,
    )

    assert intent.source_confirmation_weight == 1.0
    assert intent.source_adjusted_confidence == 82.0


def test_trade_intent_marks_supporting_conflicting_and_missing_quality_flags():
    bearish_flow = OptionsFlowSignal(symbol="AAPL", direction="BEARISH", premium=1_200_000, contracts=100)
    bullish_flow = OptionsFlowSignal(symbol="AAPL", direction="BULLISH", premium=600_000, contracts=50)
    exposure = ExposureNode(
        symbol="AAPL",
        price=180.1,
        exposure=-750_000,
        kind="GEX",
        expires_at=None,
        updated_at=datetime.now(timezone.utc),
    )

    intent = build_trade_intent(
        _score(
            score=82.0,
            direction="BULLISH",
            level=_level(side_bias="SELL"),
            exposure_nodes=[exposure],
            options_flow=[bearish_flow, bullish_flow],
        ),
        TradingPreferences(min_score=80, max_distance_pct=1.0, min_notional=50_000_000),
    )

    assert any(
        flag.severity == "caution" and flag.source == "dark_pool" and "level side bias conflicts" in flag.message
        for flag in intent.quality_flags
    )
    assert any(
        flag.severity == "support" and flag.source == "options_flow" and "1 options flow item(s) support" in flag.message
        for flag in intent.quality_flags
    )
    assert any(
        flag.severity == "caution" and flag.source == "options_flow" and "1 options flow item(s) conflict" in flag.message
        for flag in intent.quality_flags
    )
    assert any(
        flag.severity == "caution" and flag.source == "exposure" and "net exposure conflicts" in flag.message
        for flag in intent.quality_flags
    )

    missing_intent = build_trade_intent(
        _score(score=82.0, direction="BULLISH", options_flow=[], exposure_nodes=[]),
        TradingPreferences(min_score=80, max_distance_pct=1.0, min_notional=50_000_000),
    )
    assert any(
        flag.severity == "missing" and flag.source == "options_flow" and "no directional options flow" in flag.message
        for flag in missing_intent.quality_flags
    )
    assert any(
        flag.severity == "missing" and flag.source == "exposure" and "no exposure nodes" in flag.message
        for flag in missing_intent.quality_flags
    )


def test_trade_intent_blocks_when_quality_flags_exceed_user_caution_limit():
    bearish_flow = OptionsFlowSignal(symbol="AAPL", direction="BEARISH", premium=1_200_000, contracts=100)
    exposure = ExposureNode(
        symbol="AAPL",
        price=180.1,
        exposure=-750_000,
        kind="GEX",
        expires_at=None,
        updated_at=datetime.now(timezone.utc),
    )
    preferences = TradingPreferences(
        min_score=80,
        max_distance_pct=1.0,
        min_notional=50_000_000,
        max_quality_caution_flags=0,
    )

    intent = build_trade_intent(
        _score(
            score=82.0,
            direction="BULLISH",
            level=_level(side_bias="SELL"),
            exposure_nodes=[exposure],
            options_flow=[bearish_flow],
        ),
        preferences,
    )
    sentinel = LocalSentinelEdgeAdapter().review(
        intent,
        SentinelConfirmation(price_confirmed=True, liquidity_confirmed=True, news_checked=True),
    )

    assert intent.status == "blocked"
    assert intent.action == "HOLD"
    assert any("quality caution flags" in blocker and "exceed user maximum 0" in blocker for blocker in intent.blockers)
    assert sentinel.status == "rejected"


def test_trade_intent_blocks_when_quality_support_requirement_is_not_met():
    preferences = TradingPreferences(
        min_score=80,
        max_distance_pct=1.0,
        min_notional=50_000_000,
        min_quality_support_flags=2,
    )

    intent = build_trade_intent(
        _score(score=82.0, direction="BULLISH", level=_level(side_bias="BUY"), options_flow=[], exposure_nodes=[]),
        preferences,
    )

    assert intent.status == "blocked"
    assert intent.action == "HOLD"
    assert any("quality support flags" in blocker and "below user minimum 2" in blocker for blocker in intent.blockers)


def test_trade_intent_blocks_when_source_confirmation_weight_is_below_user_minimum():
    preferences = TradingPreferences(
        min_score=80,
        max_distance_pct=1.0,
        min_notional=50_000_000,
        min_source_confirmation_weight=0.35,
    )

    intent = build_trade_intent(_score(score=82.0), preferences, source_confirmation_weight=0.0)

    assert intent.status == "blocked"
    assert intent.action == "HOLD"
    assert any(
        "source confirmation weight 0.00 is below user minimum 0.35" in blocker for blocker in intent.blockers
    )


def test_trade_intent_keeps_risk_plan_when_blocked_by_source_coverage_only():
    intent = build_trade_intent(
        _score(score=82.0),
        TradingPreferences(min_score=80, max_distance_pct=1.0, min_notional=50_000_000),
        source_confirmation_weight=0.9,
        source_coverage_complete=False,
        missing_required_source_coverage=["Trading halt/LULD blocker"],
    )

    assert intent.status == "blocked"
    assert intent.action == "HOLD"
    assert intent.risk_plan is not None
    assert intent.risk_plan.planned_action == "BUY"
    assert intent.risk_plan.max_risk_dollars == 500.0
    assert any("required source coverage is incomplete" in blocker for blocker in intent.blockers)


def test_trade_intent_risk_plan_uses_share_rounded_notional_and_entry_stop_loss():
    intent = build_trade_intent(
        _score(score=82.0),
        TradingPreferences(
            min_score=80,
            max_distance_pct=1.0,
            min_notional=50_000_000,
            max_risk_dollars=500,
            stop_distance_pct=1.0,
            reward_risk_ratio=2.0,
            max_position_notional=50_000,
        ),
    )

    assert intent.risk_plan is not None
    assert intent.risk_plan.estimated_shares == 278
    assert intent.risk_plan.position_notional == 49873.2
    assert intent.risk_plan.estimated_loss_dollars == 333.6
    assert intent.risk_plan.estimated_gain_dollars == 1167.6


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
    assert [check.name for check in sentinel.checks] == [
        "intent_ready",
        "price_confirmation",
        "liquidity_confirmation",
        "news_check",
        "spread_guard",
    ]
    assert all(check.status == "passed" for check in sentinel.checks)
    packet = prepare_pulse_packet(intent, sentinel)
    assert packet["destination"] == "pulse"
    assert packet["action"] == "BUY"
    assert packet["requires_manual_execution"] is True
    assert packet["sentinel_decision_id"] == sentinel.decision_id
    assert packet["risk_plan"]["max_risk_dollars"] == 500.0
    assert packet["risk_plan"]["reward_risk_ratio"] == 2.0
    assert packet["risk_plan"]["planned_action"] == "BUY"
    assert packet["sentinel_confirmation"]["price_confirmed"] is True
    assert packet["source_confirmation_weight"] == intent.source_confirmation_weight
    assert packet["source_adjusted_confidence"] == intent.source_adjusted_confidence
    assert packet["quality_flags"] == [flag.model_dump(mode="json") for flag in intent.quality_flags]
    assert packet["sentinel_checks"] == [check.model_dump(mode="json") for check in sentinel.checks]


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
    assert any(
        check.name == "price_confirmation" and check.status == "failed" and "required before Pulse" in check.message
        for check in sentinel.checks
    )
    assert any(check.name == "liquidity_confirmation" and check.status == "passed" for check in sentinel.checks)
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
    assert sentinel.checks[0].name == "intent_ready"
    assert sentinel.checks[0].status == "failed"
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
        "&require_source_coverage_complete=false"
        "&max_risk_dollars=750&stop_distance_pct=1.2&reward_risk_ratio=2.5&max_position_notional=40000"
        "&price_confirmed=true&liquidity_confirmed=true&news_checked=true&observed_spread_bps=5&max_spread_bps=20"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["symbol"] == "AAPL"
    assert body["preferences"]["min_score"] == 60.0
    assert body["preferences"]["max_quality_caution_flags"] == 99
    assert body["preferences"]["min_quality_support_flags"] == 0
    assert body["preferences"]["min_source_confirmation_weight"] == 0.0
    assert body["preferences"]["require_complete_source_coverage"] is False
    assert body["intent"]["status"] in {"ready_for_sentinel", "blocked"}
    assert "readable_summary" in body["intent"]
    assert body["intent"]["confidence_breakdown"]
    assert body["intent"]["confidence_breakdown"][0]["name"] == "Dark pool level"
    assert body["intent"]["quality_flags"]
    assert body["intent"]["source_confirmation_weight"] == body["confirmation_sources"]["available_confirmation_weight"]
    assert "source_adjusted_confidence" in body["intent"]
    assert body["sentinel"]["checks"]
    assert body["confirmation_sources"]["sources"]
    assert any(source["id"] == "finra_otc_transparency" for source in body["confirmation_sources"]["sources"])
    finra_source = next(source for source in body["confirmation_sources"]["sources"] if source["id"] == "finra_otc_transparency")
    assert finra_source["status"] == "missing"
    assert "real-time price/NBBO" in body["confirmation_sources"]["recommended_next_sources"][0]
    if body["sentinel"]["status"] == "approved":
        assert body["pulse_packet"]["destination"] == "pulse"
        assert body["pulse_packet"]["requires_manual_execution"] is True
        assert body["intent"]["risk_plan"]["max_risk_dollars"] == 750.0
        assert body["pulse_packet"]["risk_plan"]["max_position_notional"] == 40000.0
        assert body["pulse_packet"]["quality_flags"] == body["intent"]["quality_flags"]
        assert body["pulse_packet"]["sentinel_checks"] == body["sentinel"]["checks"]
        assert body["sentinel"]["confirmation"]["observed_spread_bps"] == 5.0
    else:
        assert body["pulse_packet"] is None


def test_trade_intent_endpoint_defaults_to_blocking_pulse_until_required_source_coverage_is_complete():
    client = TestClient(server.app)

    response = client.get(
        "/darkpool/trade-intent?symbol=AAPL&provider=demo&min_score=60"
        "&max_distance_pct=2.0&min_notional=1000000&include_pulse_packet=true"
        "&price_confirmed=true&liquidity_confirmed=true&news_checked=true"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["preferences"]["require_complete_source_coverage"] is True
    assert body["confirmation_sources"]["required_coverage_complete"] is False
    assert body["intent"]["status"] == "blocked"
    assert body["sentinel"]["status"] == "rejected"
    assert body["pulse_packet"] is None
    assert body["pulse_status"]["status"] == "withheld"
    assert any("required source coverage" in blocker for blocker in body["intent"]["blockers"])
    assert any("Real-time price/NBBO confirmation" in blocker for blocker in body["intent"]["blockers"])
    assert any("Material news context" in reason for reason in body["pulse_status"]["reasons"])
    assert body["intent"]["missing_required_source_coverage"] == [
        "Real-time price/NBBO confirmation",
        "Liquidity and depth confirmation",
        "Trading halt/LULD blocker",
        "Material news context",
    ]


def test_trade_intent_endpoint_clears_source_coverage_block_when_required_adapters_are_configured(monkeypatch):
    client = TestClient(server.app)
    monkeypatch.setenv("POLYGON_API_KEY", "test-polygon")
    monkeypatch.setenv("NASDAQ_HALTS_RSS_ENABLED", "true")
    monkeypatch.setenv("SEC_EDGAR_USER_AGENT", "darkpool-mon test@example.com")

    response = client.get(
        "/darkpool/trade-intent?symbol=AAPL&provider=demo&min_score=60"
        "&max_distance_pct=2.0&min_notional=1000000&include_pulse_packet=true"
        "&price_confirmed=true&liquidity_confirmed=true&news_checked=true&observed_spread_bps=5&max_spread_bps=20"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["confirmation_sources"]["required_coverage_complete"] is True
    assert body["intent"]["missing_required_source_coverage"] == []
    assert body["pulse_status"]["status"] == "prepared"
    assert body["pulse_packet"]["required_source_coverage_complete"] is True
    assert body["pulse_packet"]["missing_required_source_coverage"] == []
    coverage = {item["role"]: item for item in body["pulse_packet"]["source_coverage"]}
    assert coverage["risk_blocker"]["status"] == "met"
    assert coverage["news_context"]["status"] == "met"
    assert body["pulse_packet"]["requires_manual_execution"] is True


def test_trade_intent_endpoint_withholds_pulse_until_confirmation_is_complete():
    client = TestClient(server.app)

    response = client.get(
        "/darkpool/trade-intent?symbol=AAPL&provider=demo&min_score=60"
        "&max_distance_pct=2.0&min_notional=1000000&include_pulse_packet=true"
        "&require_source_coverage_complete=false"
        "&price_confirmed=false&liquidity_confirmed=true&news_checked=true"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sentinel"]["status"] == "rejected"
    assert body["pulse_packet"] is None
    assert body["pulse_status"]["status"] == "withheld"
    assert body["pulse_status"]["requires_manual_execution"] is True
    assert body["pulse_status"]["sentinel_status"] == "rejected"
    assert any("price confirmation" in reason for reason in body["pulse_status"]["reasons"])
    assert any("price confirmation" in reason for reason in body["sentinel"]["reasons"])


def test_trade_intent_endpoint_exposes_quality_gate_customization():
    client = TestClient(server.app)

    response = client.get(
        "/darkpool/trade-intent?symbol=AAPL&provider=demo&min_score=60"
        "&max_distance_pct=2.0&min_notional=1000000&include_pulse_packet=true"
        "&price_confirmed=true&liquidity_confirmed=true&news_checked=true"
        "&max_quality_caution_flags=99&min_quality_support_flags=99"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["preferences"]["max_quality_caution_flags"] == 99
    assert body["preferences"]["min_quality_support_flags"] == 99
    assert body["intent"]["status"] == "blocked"
    assert body["sentinel"]["status"] == "rejected"
    assert body["pulse_packet"] is None
    assert any("quality support flags" in blocker for blocker in body["intent"]["blockers"])


def test_trade_intent_endpoint_blocks_when_source_confirmation_requirement_is_not_met():
    client = TestClient(server.app)

    response = client.get(
        "/darkpool/trade-intent?symbol=AAPL&provider=demo&min_score=60"
        "&max_distance_pct=2.0&min_notional=1000000&include_pulse_packet=true"
        "&price_confirmed=true&liquidity_confirmed=true&news_checked=true"
        "&min_source_confirmation_weight=0.35"
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["preferences"]["min_source_confirmation_weight"] == 0.35
    assert body["confirmation_sources"]["available_confirmation_weight"] == 0.0
    assert body["intent"]["status"] == "blocked"
    assert body["sentinel"]["status"] == "rejected"
    assert body["pulse_packet"] is None
    assert any("source confirmation weight" in blocker for blocker in body["intent"]["blockers"])


def test_trade_intent_endpoint_rejects_source_confirmation_threshold_above_full_coverage():
    client = TestClient(server.app)

    response = client.get(
        "/darkpool/trade-intent?symbol=AAPL&provider=demo&min_source_confirmation_weight=1.01"
    )

    assert response.status_code == 422
