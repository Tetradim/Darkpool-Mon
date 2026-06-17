"""Trade-intent gating for Sentinel Edge and Pulse handoff."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from math import floor
from typing import Literal, Protocol

from pydantic import BaseModel, Field

from .models import ConfluenceScore


TradeAction = Literal["BUY", "SELL", "HOLD"]
IntentStatus = Literal["blocked", "ready_for_sentinel"]
DecisionStatus = Literal["approved", "rejected"]
QualitySeverity = Literal["support", "caution", "missing"]
CheckStatus = Literal["passed", "failed"]


class TradingPreferences(BaseModel):
    min_score: float = Field(default=75.0, ge=0, le=100)
    max_distance_pct: float = Field(default=1.0, ge=0, le=10)
    min_notional: float = Field(default=25_000_000.0, ge=0)
    max_freshness_minutes: float = Field(default=120.0, ge=0)
    max_risk_dollars: float = Field(default=500.0, ge=0)
    stop_distance_pct: float = Field(default=1.0, ge=0)
    reward_risk_ratio: float = Field(default=2.0, ge=0)
    max_position_notional: float = Field(default=50_000.0, ge=0)
    max_quality_caution_flags: int = Field(default=99, ge=0)
    min_quality_support_flags: int = Field(default=0, ge=0)
    min_source_confirmation_weight: float = Field(default=0.0, ge=0)
    require_complete_source_coverage: bool = True
    require_directional_bias: bool = True
    allowed_actions: list[Literal["BUY", "SELL"]] = Field(default_factory=lambda: ["BUY", "SELL"])


class RiskPlan(BaseModel):
    max_risk_dollars: float
    stop_distance_pct: float
    reward_risk_ratio: float
    max_position_notional: float
    position_notional: float
    estimated_shares: int
    stop_price: float
    target_price: float
    estimated_loss_dollars: float
    estimated_gain_dollars: float
    notes: list[str]


class ConfidenceComponent(BaseModel):
    name: str
    contribution: float
    max_contribution: float
    explanation: str


class QualityFlag(BaseModel):
    severity: QualitySeverity
    source: str
    message: str


class SentinelConfirmation(BaseModel):
    price_confirmed: bool = False
    liquidity_confirmed: bool = False
    news_checked: bool = False
    observed_spread_bps: float = Field(default=0.0, ge=0)
    max_spread_bps: float = Field(default=25.0, ge=0)


class SentinelCheck(BaseModel):
    name: str
    status: CheckStatus
    message: str


class TradeIntent(BaseModel):
    id: str
    symbol: str
    action: TradeAction
    status: IntentStatus
    confidence: float
    level_price: float
    spot_price: float
    distance_pct: float
    notional: float
    created_at: datetime
    readable_summary: str
    reasons: list[str]
    blockers: list[str]
    source_confirmation_weight: float
    source_adjusted_confidence: float
    missing_required_source_coverage: list[str] = Field(default_factory=list)
    risk_plan: RiskPlan | None = None
    confidence_breakdown: list[ConfidenceComponent]
    quality_flags: list[QualityFlag]


class SentinelDecision(BaseModel):
    decision_id: str
    status: DecisionStatus
    reviewer: str = "local_sentinel_edge"
    reviewed_at: datetime
    reasons: list[str]
    confirmation: SentinelConfirmation | None = None
    checks: list[SentinelCheck]


class SentinelEdgeAdapter(Protocol):
    def review(self, intent: TradeIntent, confirmation: SentinelConfirmation | None = None) -> SentinelDecision:
        """Review a trade intent before Pulse communication."""


def _action_from_direction(direction: str) -> TradeAction:
    if direction == "BULLISH":
        return "BUY"
    if direction == "BEARISH":
        return "SELL"
    return "HOLD"


def _stable_id(*parts: object) -> str:
    digest = hashlib.sha256("|".join(str(part) for part in parts).encode("utf-8")).hexdigest()
    return digest[:16]


def _build_risk_plan(score: ConfluenceScore, action: TradeAction, preferences: TradingPreferences, blockers: list[str]) -> RiskPlan | None:
    if action not in {"BUY", "SELL"}:
        return None
    if preferences.max_risk_dollars <= 0:
        blockers.append("risk budget must be greater than zero")
    if preferences.stop_distance_pct <= 0:
        blockers.append("stop distance must be greater than zero")
    if preferences.reward_risk_ratio <= 0:
        blockers.append("reward/risk ratio must be greater than zero")
    if preferences.max_position_notional <= 0:
        blockers.append("max position notional must be greater than zero")
    if score.spot_price <= 0:
        blockers.append("spot price must be greater than zero for position sizing")
    if blockers:
        return None

    stop_fraction = preferences.stop_distance_pct / 100
    risk_limited_notional = preferences.max_risk_dollars / stop_fraction
    position_notional = min(risk_limited_notional, preferences.max_position_notional)
    estimated_shares = floor(position_notional / score.spot_price)
    if estimated_shares <= 0:
        blockers.append("position sizing produced zero shares")
        return None

    if action == "BUY":
        stop_price = score.level_price * (1 - stop_fraction)
        target_price = score.level_price * (1 + stop_fraction * preferences.reward_risk_ratio)
    else:
        stop_price = score.level_price * (1 + stop_fraction)
        target_price = score.level_price * (1 - stop_fraction * preferences.reward_risk_ratio)

    notes = ["position sizing is a planning envelope, not an order"]
    if position_notional < risk_limited_notional:
        notes.append("position capped by max position notional")

    estimated_loss = position_notional * stop_fraction
    return RiskPlan(
        max_risk_dollars=float(preferences.max_risk_dollars),
        stop_distance_pct=float(preferences.stop_distance_pct),
        reward_risk_ratio=float(preferences.reward_risk_ratio),
        max_position_notional=float(preferences.max_position_notional),
        position_notional=round(position_notional, 2),
        estimated_shares=estimated_shares,
        stop_price=round(stop_price, 2),
        target_price=round(target_price, 2),
        estimated_loss_dollars=round(min(estimated_loss, preferences.max_risk_dollars), 2),
        estimated_gain_dollars=round(min(estimated_loss, preferences.max_risk_dollars) * preferences.reward_risk_ratio, 2),
        notes=notes,
    )


def _build_confidence_breakdown(score: ConfluenceScore) -> list[ConfidenceComponent]:
    directional_flows = [flow for flow in score.options_flow if flow.direction in {"BULLISH", "BEARISH"}]
    options_premium = sum(flow.premium for flow in directional_flows)
    exposure_total = sum(abs(node.exposure) for node in score.exposure_nodes)
    price_proximity = 12.0 if any("spot is within" in reason for reason in score.reasons) or score.distance_pct <= 1.0 else 0.0
    clustered = 5.0 if score.level.print_count >= 3 else 0.0
    fresh = 5.0 if score.level.freshness_minutes <= 60 else 0.0

    return [
        ConfidenceComponent(
            name="Dark pool level",
            contribution=round(min(55.0, score.level.strength_score * 0.55), 2),
            max_contribution=55.0,
            explanation=f"cluster strength {score.level.strength_score:.1f} from {score.level.print_count} print(s)",
        ),
        ConfidenceComponent(
            name="Price proximity",
            contribution=round(price_proximity, 2),
            max_contribution=12.0,
            explanation=f"spot is {score.distance_pct:.2f}% from the level",
        ),
        ConfidenceComponent(
            name="Exposure alignment",
            contribution=round(min(20.0, exposure_total / 250_000), 2),
            max_contribution=20.0,
            explanation=f"{len(score.exposure_nodes)} nearby exposure node(s)",
        ),
        ConfidenceComponent(
            name="Options flow",
            contribution=round(min(13.0, options_premium / 350_000), 2),
            max_contribution=13.0,
            explanation=f"{len(directional_flows)} directional flow print(s)",
        ),
        ConfidenceComponent(
            name="Print clustering",
            contribution=clustered,
            max_contribution=5.0,
            explanation=f"{score.level.print_count} print(s) in the level cluster",
        ),
        ConfidenceComponent(
            name="Freshness",
            contribution=fresh,
            max_contribution=5.0,
            explanation=f"latest level print age {score.level.freshness_minutes:.1f} minute(s)",
        ),
    ]


def _build_quality_flags(score: ConfluenceScore, action: TradeAction) -> list[QualityFlag]:
    if action not in {"BUY", "SELL"}:
        return [
            QualityFlag(
                severity="missing",
                source="direction",
                message="no directional action to evaluate evidence quality",
            )
        ]

    flags: list[QualityFlag] = []
    level_side = score.level.side_bias
    supportive_level_side = "BUY" if action == "BUY" else "SELL"
    opposing_level_side = "SELL" if action == "BUY" else "BUY"

    if level_side == supportive_level_side:
        flags.append(
            QualityFlag(
                severity="support",
                source="dark_pool",
                message=f"level side bias supports {action}",
            )
        )
    elif level_side == opposing_level_side:
        flags.append(
            QualityFlag(
                severity="caution",
                source="dark_pool",
                message=f"level side bias conflicts with {action}",
            )
        )
    else:
        flags.append(
            QualityFlag(
                severity="missing",
                source="dark_pool",
                message="level side bias is neutral",
            )
        )

    directional_flows = [flow for flow in score.options_flow if flow.direction in {"BULLISH", "BEARISH"}]
    supportive_flow_direction = "BULLISH" if action == "BUY" else "BEARISH"
    opposing_flow_direction = "BEARISH" if action == "BUY" else "BULLISH"
    supporting_flows = [flow for flow in directional_flows if flow.direction == supportive_flow_direction]
    opposing_flows = [flow for flow in directional_flows if flow.direction == opposing_flow_direction]

    if not directional_flows:
        flags.append(
            QualityFlag(
                severity="missing",
                source="options_flow",
                message="no directional options flow available",
            )
        )
    if supporting_flows:
        flags.append(
            QualityFlag(
                severity="support",
                source="options_flow",
                message=f"{len(supporting_flows)} options flow item(s) support {action}",
            )
        )
    if opposing_flows:
        flags.append(
            QualityFlag(
                severity="caution",
                source="options_flow",
                message=f"{len(opposing_flows)} options flow item(s) conflict with {action}",
            )
        )

    if not score.exposure_nodes:
        flags.append(
            QualityFlag(
                severity="missing",
                source="exposure",
                message="no exposure nodes available",
            )
        )
    else:
        net_exposure = sum(node.exposure for node in score.exposure_nodes)
        if net_exposure == 0:
            flags.append(
                QualityFlag(
                    severity="missing",
                    source="exposure",
                    message="net exposure is neutral",
                )
            )
        elif (action == "BUY" and net_exposure > 0) or (action == "SELL" and net_exposure < 0):
            flags.append(
                QualityFlag(
                    severity="support",
                    source="exposure",
                    message=f"net exposure supports {action}",
                )
            )
        else:
            flags.append(
                QualityFlag(
                    severity="caution",
                    source="exposure",
                    message=f"net exposure conflicts with {action}",
                )
            )

    return flags


def _apply_quality_gates(quality_flags: list[QualityFlag], preferences: TradingPreferences, blockers: list[str]) -> None:
    caution_count = sum(1 for flag in quality_flags if flag.severity == "caution")
    support_count = sum(1 for flag in quality_flags if flag.severity == "support")

    if caution_count > preferences.max_quality_caution_flags:
        blockers.append(
            f"quality caution flags {caution_count} exceed user maximum {preferences.max_quality_caution_flags}"
        )
    if support_count < preferences.min_quality_support_flags:
        blockers.append(
            f"quality support flags {support_count} are below user minimum {preferences.min_quality_support_flags}"
        )


def _apply_source_confirmation_gate(
    source_confirmation_weight: float,
    source_coverage_complete: bool,
    missing_required_source_coverage: list[str] | None,
    preferences: TradingPreferences,
    blockers: list[str],
) -> None:
    if source_confirmation_weight < preferences.min_source_confirmation_weight:
        blockers.append(
            f"source confirmation weight {source_confirmation_weight:.2f} is below user minimum "
            f"{preferences.min_source_confirmation_weight:.2f}"
        )
    if preferences.require_complete_source_coverage and not source_coverage_complete:
        missing = ", ".join(missing_required_source_coverage or [])
        suffix = f": {missing}" if missing else ""
        blockers.append(
            "required source coverage is incomplete; configure price/NBBO, liquidity/depth, halt/LULD, "
            f"and material-news sources before Pulse{suffix}"
        )


def _source_adjusted_confidence(raw_confidence: float, source_confirmation_weight: float) -> float:
    capped_weight = min(1.0, max(0.0, source_confirmation_weight))
    return round(raw_confidence * capped_weight, 2)


def build_trade_intent(
    score: ConfluenceScore,
    preferences: TradingPreferences | None = None,
    source_confirmation_weight: float = 0.0,
    source_coverage_complete: bool = True,
    missing_required_source_coverage: list[str] | None = None,
) -> TradeIntent:
    preferences = preferences or TradingPreferences()
    candidate_action = _action_from_direction(score.direction)
    blockers: list[str] = []
    missing_source_coverage = list(missing_required_source_coverage or [])

    if score.score < preferences.min_score:
        blockers.append(f"score {score.score:.1f} is below user minimum score {preferences.min_score:.1f}")
    if score.distance_pct > preferences.max_distance_pct:
        blockers.append(
            f"level distance {score.distance_pct:.2f}% is farther than allowed {preferences.max_distance_pct:.2f}%"
        )
    if score.level.notional < preferences.min_notional:
        blockers.append(
            f"level notional ${score.level.notional:,.0f} is below user minimum notional ${preferences.min_notional:,.0f}"
        )
    if score.level.freshness_minutes > preferences.max_freshness_minutes:
        blockers.append(
            f"level age {score.level.freshness_minutes:.1f} minutes exceeds {preferences.max_freshness_minutes:.1f} minutes"
        )
    if preferences.require_directional_bias and candidate_action == "HOLD":
        blockers.append("direction is neutral; user settings require directional bias")
    if candidate_action in {"BUY", "SELL"} and candidate_action not in preferences.allowed_actions:
        blockers.append(f"{candidate_action} is not enabled in user allowed actions")

    quality_flags = _build_quality_flags(score, candidate_action)
    _apply_quality_gates(quality_flags, preferences, blockers)
    _apply_source_confirmation_gate(
        source_confirmation_weight,
        source_coverage_complete,
        missing_source_coverage,
        preferences,
        blockers,
    )
    source_weight = round(max(0.0, source_confirmation_weight), 2)
    source_adjusted_confidence = _source_adjusted_confidence(score.score, source_weight)
    risk_plan = _build_risk_plan(score, candidate_action, preferences, blockers)
    confidence_breakdown = _build_confidence_breakdown(score)
    status: IntentStatus = "blocked" if blockers or candidate_action == "HOLD" or risk_plan is None else "ready_for_sentinel"
    action: TradeAction = "HOLD" if status == "blocked" else candidate_action
    if status == "blocked":
        summary = (
            f"{score.symbol} blocked: candidate {candidate_action} confidence {score.score:.1f}/100 "
            f"near ${score.level_price:.2f}; "
            f"{len(blockers)} blocker(s) require review."
        )
    else:
        summary = (
            f"{score.symbol} {action} intent ready: {score.score:.1f}/100 confidence near ${score.level_price:.2f}; "
            "Sentinel Edge approval is required before Pulse."
        )

    return TradeIntent(
        id=f"{score.symbol}:{action}:{round(score.level_price, 2)}:{_stable_id(score.symbol, action, score.level_price, score.score)}",
        symbol=score.symbol,
        action=action,
        status=status,
        confidence=score.score,
        level_price=score.level_price,
        spot_price=score.spot_price,
        distance_pct=score.distance_pct,
        notional=score.level.notional,
        created_at=datetime.now(timezone.utc),
        readable_summary=summary,
        reasons=score.reasons,
        blockers=blockers,
        source_confirmation_weight=source_weight,
        source_adjusted_confidence=source_adjusted_confidence,
        missing_required_source_coverage=missing_source_coverage
        if preferences.require_complete_source_coverage and not source_coverage_complete
        else [],
        risk_plan=risk_plan,
        confidence_breakdown=confidence_breakdown,
        quality_flags=quality_flags,
    )


class LocalSentinelEdgeAdapter:
    """Local confirmation adapter used until a concrete Sentinel Edge API exists."""

    def review(self, intent: TradeIntent, confirmation: SentinelConfirmation | None = None) -> SentinelDecision:
        confirmation = confirmation or SentinelConfirmation()
        if intent.status != "ready_for_sentinel":
            message = "; ".join(intent.blockers) if intent.blockers else "intent is not ready for Sentinel Edge approval"
            return SentinelDecision(
                decision_id=f"sentinel:{intent.id}:{_stable_id(intent.id, 'rejected')}",
                status="rejected",
                reviewed_at=datetime.now(timezone.utc),
                reasons=intent.blockers or [message],
                confirmation=confirmation,
                checks=[
                    SentinelCheck(
                        name="intent_ready",
                        status="failed",
                        message=message,
                    )
                ],
            )

        checks = [
            SentinelCheck(
                name="intent_ready",
                status="passed",
                message="intent passed user thresholds, risk controls, and quality gates",
            )
        ]
        if not confirmation.price_confirmed:
            checks.append(
                SentinelCheck(
                    name="price_confirmation",
                    status="failed",
                    message="price confirmation required before Pulse",
                )
            )
        else:
            checks.append(
                SentinelCheck(
                    name="price_confirmation",
                    status="passed",
                    message="price confirmation complete",
                )
            )
        if not confirmation.liquidity_confirmed:
            checks.append(
                SentinelCheck(
                    name="liquidity_confirmation",
                    status="failed",
                    message="liquidity confirmation required before Pulse",
                )
            )
        else:
            checks.append(
                SentinelCheck(
                    name="liquidity_confirmation",
                    status="passed",
                    message="liquidity confirmation complete",
                )
            )
        if not confirmation.news_checked:
            checks.append(
                SentinelCheck(
                    name="news_check",
                    status="failed",
                    message="news check required before Pulse",
                )
            )
        else:
            checks.append(
                SentinelCheck(
                    name="news_check",
                    status="passed",
                    message="news check complete",
                )
            )
        if confirmation.observed_spread_bps > confirmation.max_spread_bps:
            checks.append(
                SentinelCheck(
                    name="spread_guard",
                    status="failed",
                    message=(
                        f"spread {confirmation.observed_spread_bps:.1f} bps exceeds max "
                        f"{confirmation.max_spread_bps:.1f} bps"
                    ),
                )
            )
        else:
            checks.append(
                SentinelCheck(
                    name="spread_guard",
                    status="passed",
                    message=(
                        f"spread {confirmation.observed_spread_bps:.1f} bps is within "
                        f"{confirmation.max_spread_bps:.1f} bps max"
                    ),
                )
            )
        rejection_reasons = [check.message for check in checks if check.status == "failed"]
        if rejection_reasons:
            return SentinelDecision(
                decision_id=f"sentinel:{intent.id}:{_stable_id(intent.id, 'confirmation-rejected')}",
                status="rejected",
                reviewed_at=datetime.now(timezone.utc),
                reasons=rejection_reasons,
                confirmation=confirmation,
                checks=checks,
            )

        return SentinelDecision(
            decision_id=f"sentinel:{intent.id}:{_stable_id(intent.id, 'approved')}",
            status="approved",
            reviewed_at=datetime.now(timezone.utc),
            reasons=[
                "intent passed user thresholds",
                "price, liquidity, and news confirmations complete",
                f"spread {confirmation.observed_spread_bps:.1f} bps is within {confirmation.max_spread_bps:.1f} bps max",
                "Pulse packet may be prepared for manual execution review",
            ],
            confirmation=confirmation,
            checks=checks,
        )


def prepare_pulse_packet(intent: TradeIntent, sentinel_decision: SentinelDecision) -> dict:
    if sentinel_decision.status != "approved" or intent.status != "ready_for_sentinel":
        raise ValueError("Sentinel Edge approval is required before Pulse communication")

    return {
        "destination": "pulse",
        "packet_type": "trade_intent",
        "symbol": intent.symbol,
        "action": intent.action,
        "confidence": intent.confidence,
        "source_confirmation_weight": intent.source_confirmation_weight,
        "source_adjusted_confidence": intent.source_adjusted_confidence,
        "level_price": intent.level_price,
        "spot_price": intent.spot_price,
        "distance_pct": intent.distance_pct,
        "notional": intent.notional,
        "sentinel_decision_id": sentinel_decision.decision_id,
        "sentinel_confirmation": sentinel_decision.confirmation.model_dump(mode="json")
        if sentinel_decision.confirmation
        else None,
        "requires_manual_execution": True,
        "risk_plan": intent.risk_plan.model_dump(mode="json") if intent.risk_plan else None,
        "confidence_breakdown": [component.model_dump(mode="json") for component in intent.confidence_breakdown],
        "quality_flags": [flag.model_dump(mode="json") for flag in intent.quality_flags],
        "sentinel_checks": [check.model_dump(mode="json") for check in sentinel_decision.checks],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "reasons": intent.reasons,
    }
