from datetime import datetime, timezone

from darkpool.alerting import AlertDeduplicator, build_alert_candidates
from darkpool.confluence import score_confluence
from darkpool.models import DarkpoolLevel, ExposureNode, OptionsFlowSignal


def test_confluence_scores_nearby_exposure_and_options_flow_higher():
    level = DarkpoolLevel(
        symbol="NVDA",
        price=900.0,
        total_size=500_000,
        notional=450_000_000,
        print_count=4,
        first_seen=datetime.now(timezone.utc),
        last_seen=datetime.now(timezone.utc),
        venues=["ATS"],
        strength_score=88.0,
    )
    nearby_node = ExposureNode(
        symbol="NVDA",
        price=901.0,
        exposure=2_500_000,
        kind="GEX",
        expires_at=None,
        updated_at=datetime.now(timezone.utc),
    )
    flow = OptionsFlowSignal(symbol="NVDA", direction="BULLISH", premium=2_000_000, contracts=150)

    scores = score_confluence("NVDA", 899.5, [level], [nearby_node], [flow])

    assert scores
    assert scores[0].score >= 70
    assert "exposure" in scores[0].reasons[0].lower() or any("exposure" in reason.lower() for reason in scores[0].reasons)


def test_alert_deduplicator_suppresses_repeated_alert_keys():
    level = DarkpoolLevel(
        symbol="AAPL",
        price=190.0,
        total_size=300_000,
        notional=57_000_000,
        print_count=3,
        first_seen=datetime.now(timezone.utc),
        last_seen=datetime.now(timezone.utc),
        venues=["ATS"],
        strength_score=80.0,
    )
    candidates = build_alert_candidates("AAPL", [level])
    deduper = AlertDeduplicator(window_seconds=60)

    assert deduper.allow(candidates[0]) is True
    assert deduper.allow(candidates[0]) is False
