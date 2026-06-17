"""End-to-end trade-intent report assembly."""

from __future__ import annotations

from dataclasses import dataclass

from .market_context import MarketContext, build_market_context
from .trade_intent import (
    LocalSentinelEdgeAdapter,
    SentinelConfirmation,
    SentinelDecision,
    TradeIntent,
    TradingPreferences,
    build_trade_intent,
    prepare_pulse_packet,
)


@dataclass(frozen=True)
class TradeIntentReport:
    context: MarketContext
    preferences: TradingPreferences
    intent: TradeIntent | None
    sentinel: SentinelDecision | None
    pulse_packet: dict | None


async def build_trade_intent_report(
    symbol: str,
    provider: str,
    preferences: TradingPreferences,
    confirmation: SentinelConfirmation,
    include_pulse_packet: bool = False,
    price_bucket: float = 0.10,
    limit: int = 500,
    configured_providers: list[str] | None = None,
) -> TradeIntentReport:
    context = await build_market_context(
        symbol,
        provider=provider,
        limit=limit,
        price_bucket=price_bucket,
        configured_providers=configured_providers,
    )
    if not context.scores:
        return TradeIntentReport(
            context=context,
            preferences=preferences,
            intent=None,
            sentinel=None,
            pulse_packet=None,
        )

    intent = build_trade_intent(
        context.scores[0],
        preferences,
        source_confirmation_weight=context.confirmation_plan.available_confirmation_weight,
    )
    sentinel = LocalSentinelEdgeAdapter().review(intent, confirmation)
    pulse_packet = None
    if include_pulse_packet and sentinel.status == "approved":
        pulse_packet = prepare_pulse_packet(intent, sentinel)

    return TradeIntentReport(
        context=context,
        preferences=preferences,
        intent=intent,
        sentinel=sentinel,
        pulse_packet=pulse_packet,
    )
