"""Dark pool print clustering and level scoring."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from math import floor, log10
from statistics import mean

from .models import DarkpoolLevel, DarkpoolPrint


def _bucket_price(price: float, price_bucket: float) -> float:
    return round(floor(price / price_bucket) * price_bucket, 2)


def _freshness_minutes(last_seen: datetime, now: datetime) -> float:
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    return max(0.0, (now - last_seen).total_seconds() / 60)


def _score_level(total_size: int, notional: float, print_count: int, freshness: float, unique_venues: int) -> float:
    size_component = min(35.0, log10(max(total_size, 1)) * 5.0)
    notional_component = min(35.0, log10(max(notional, 1)) * 4.0)
    count_component = min(15.0, print_count * 3.0)
    venue_component = min(5.0, unique_venues * 1.5)
    decay_component = max(0.0, 10.0 - freshness / 45.0)
    return round(min(100.0, size_component + notional_component + count_component + venue_component + decay_component), 2)


def cluster_darkpool_levels(prints: list[DarkpoolPrint], price_bucket: float = 0.10) -> list[DarkpoolLevel]:
    """Group prints into price levels and rank by explainable strength."""
    if price_bucket <= 0:
        raise ValueError("price_bucket must be positive")

    grouped: dict[tuple[str, float], list[DarkpoolPrint]] = defaultdict(list)
    for print_ in prints:
        grouped[(print_.symbol.upper(), _bucket_price(print_.price, price_bucket))].append(print_)

    now = datetime.now(timezone.utc)
    levels: list[DarkpoolLevel] = []
    for (symbol, bucket), bucket_prints in grouped.items():
        sorted_prints = sorted(bucket_prints, key=lambda item: item.timestamp)
        total_size = sum(item.size for item in sorted_prints)
        notional = sum(item.notional for item in sorted_prints)
        venues = sorted({item.venue for item in sorted_prints})
        buy_size = sum(item.size for item in sorted_prints if item.direction == "BUY")
        sell_size = sum(item.size for item in sorted_prints if item.direction == "SELL")
        if buy_size > sell_size * 1.15:
            side_bias = "BUY"
        elif sell_size > buy_size * 1.15:
            side_bias = "SELL"
        else:
            side_bias = "NEUTRAL"
        freshness = _freshness_minutes(sorted_prints[-1].timestamp, now)
        levels.append(
            DarkpoolLevel(
                symbol=symbol,
                price=round(mean(item.price for item in sorted_prints), 2) if len(sorted_prints) > 1 else bucket,
                total_size=total_size,
                notional=round(notional, 2),
                print_count=len(sorted_prints),
                first_seen=sorted_prints[0].timestamp,
                last_seen=sorted_prints[-1].timestamp,
                venues=venues,
                side_bias=side_bias,
                freshness_minutes=round(freshness, 2),
                strength_score=_score_level(total_size, notional, len(sorted_prints), freshness, len(venues)),
            )
        )

    return sorted(levels, key=lambda item: (item.strength_score, item.notional), reverse=True)


def detect_air_pockets(levels: list[DarkpoolLevel], spot_price: float, min_gap_pct: float = 1.5) -> list[dict]:
    """Identify low-friction spaces between strong structural levels."""
    if len(levels) < 2:
        return []
    sorted_levels = sorted(levels, key=lambda item: item.price)
    pockets: list[dict] = []
    for left, right in zip(sorted_levels, sorted_levels[1:]):
        gap_pct = (right.price - left.price) / spot_price * 100 if spot_price > 0 else 0
        if gap_pct >= min_gap_pct:
            pockets.append(
                {
                    "from": left.price,
                    "to": right.price,
                    "gap_pct": round(gap_pct, 2),
                    "contains_spot": left.price <= spot_price <= right.price,
                }
            )
    return pockets
