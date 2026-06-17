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


class TradingPreferences(BaseModel):
    min_score: float = Field(default=75.0, ge=0, le=100)
    max_distance_pct: float = Field(default=1.0, ge=0, le=10)
    min_notional: float = Field(default=25_000_000.0, ge=0)
    max_freshness_minutes: float = Field(default=120.0, ge=0)
    max_risk_dollars: float = Field(default=500.0, ge=0)
    stop_distance_pct: float = Field(default=1.0, ge=0)
    reward_risk_ratio: float = Field(default=2.0, ge=0)
    max_position_notional: float = Field(default=50_000.0, ge=0)
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


class SentinelConfirmation(BaseModel):
    price_confirmed: bool = False
    liquidity_confirmed: bool = False
    news_checked: bool = False
    observed_spread_bps: float = Field(default=0.0, ge=0)
    max_spread_bps: float = Field(default=25.0, ge=0)


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
    risk_plan: RiskPlan | None = None


class SentinelDecision(BaseModel):
    decision_id: str
    status: DecisionStatus
    reviewer: str = "local_sentinel_edge"
    reviewed_at: datetime
    reasons: list[str]
    confirmation: SentinelConfirmation | None = None


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


def build_trade_intent(score: ConfluenceScore, preferences: TradingPreferences | None = None) -> TradeIntent:
    preferences = preferences or TradingPreferences()
    candidate_action = _action_from_direction(score.direction)
    blockers: list[str] = []

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

    risk_plan = _build_risk_plan(score, candidate_action, preferences, blockers)
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
        risk_plan=risk_plan,
    )


class LocalSentinelEdgeAdapter:
    """Local confirmation adapter used until a concrete Sentinel Edge API exists."""

    def review(self, intent: TradeIntent, confirmation: SentinelConfirmation | None = None) -> SentinelDecision:
        confirmation = confirmation or SentinelConfirmation()
        if intent.status != "ready_for_sentinel":
            return SentinelDecision(
                decision_id=f"sentinel:{intent.id}:{_stable_id(intent.id, 'rejected')}",
                status="rejected",
                reviewed_at=datetime.now(timezone.utc),
                reasons=intent.blockers or ["intent is not ready for Sentinel Edge approval"],
                confirmation=confirmation,
            )

        rejection_reasons: list[str] = []
        if not confirmation.price_confirmed:
            rejection_reasons.append("price confirmation required before Pulse")
        if not confirmation.liquidity_confirmed:
            rejection_reasons.append("liquidity confirmation required before Pulse")
        if not confirmation.news_checked:
            rejection_reasons.append("news check required before Pulse")
        if confirmation.observed_spread_bps > confirmation.max_spread_bps:
            rejection_reasons.append(
                f"spread {confirmation.observed_spread_bps:.1f} bps exceeds max {confirmation.max_spread_bps:.1f} bps"
            )
        if rejection_reasons:
            return SentinelDecision(
                decision_id=f"sentinel:{intent.id}:{_stable_id(intent.id, 'confirmation-rejected')}",
                status="rejected",
                reviewed_at=datetime.now(timezone.utc),
                reasons=rejection_reasons,
                confirmation=confirmation,
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
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "reasons": intent.reasons,
    }
