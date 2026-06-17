"""Trade-intent gating for Sentinel Edge and Pulse handoff."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
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
    require_directional_bias: bool = True
    allowed_actions: list[Literal["BUY", "SELL"]] = Field(default_factory=lambda: ["BUY", "SELL"])


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


class SentinelDecision(BaseModel):
    decision_id: str
    status: DecisionStatus
    reviewer: str = "local_sentinel_edge"
    reviewed_at: datetime
    reasons: list[str]


class SentinelEdgeAdapter(Protocol):
    def review(self, intent: TradeIntent) -> SentinelDecision:
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

    status: IntentStatus = "blocked" if blockers or candidate_action == "HOLD" else "ready_for_sentinel"
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
    )


class LocalSentinelEdgeAdapter:
    """Local confirmation adapter used until a concrete Sentinel Edge API exists."""

    def review(self, intent: TradeIntent) -> SentinelDecision:
        if intent.status != "ready_for_sentinel":
            return SentinelDecision(
                decision_id=f"sentinel:{intent.id}:{_stable_id(intent.id, 'rejected')}",
                status="rejected",
                reviewed_at=datetime.now(timezone.utc),
                reasons=intent.blockers or ["intent is not ready for Sentinel Edge approval"],
            )
        return SentinelDecision(
            decision_id=f"sentinel:{intent.id}:{_stable_id(intent.id, 'approved')}",
            status="approved",
            reviewed_at=datetime.now(timezone.utc),
            reasons=[
                "intent passed user thresholds",
                "Pulse packet may be prepared for manual execution review",
            ],
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
        "requires_manual_execution": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "reasons": intent.reasons,
    }
