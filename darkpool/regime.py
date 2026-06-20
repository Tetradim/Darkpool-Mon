"""Market-regime analysis for pre-trade bot controls."""

from __future__ import annotations

from .models import DarkpoolPrint, MarketRegime


def analyze_market_regime(symbol: str, prints: list[DarkpoolPrint], spot_price: float) -> MarketRegime:
    """Classify a simple market regime from recent prints.

    This intentionally uses only data already present in the context so demo mode,
    tests, and provider-backed workflows all expose the same gate shape.
    """
    sym = symbol.upper()
    relevant = [item for item in prints if item.symbol.upper() == sym and item.price > 0 and item.size > 0]
    if len(relevant) < 3 or spot_price <= 0:
        return MarketRegime(
            symbol=sym,
            regime="insufficient_data",
            trend_bias="neutral",
            realized_range_pct=0.0,
            momentum_pct=0.0,
            vwap=None,
            volume_imbalance=0.0,
            print_count=len(relevant),
            reasons=["not enough recent prints to classify regime"],
        )

    ordered = sorted(relevant, key=lambda item: item.timestamp)
    total_size = sum(item.size for item in ordered)
    vwap = sum(item.price * item.size for item in ordered) / total_size
    high = max(item.price for item in ordered)
    low = min(item.price for item in ordered)
    realized_range_pct = (high - low) / spot_price * 100
    momentum_pct = (ordered[-1].price - ordered[0].price) / ordered[0].price * 100
    buy_size = sum(item.size for item in ordered if item.direction == "BUY")
    sell_size = sum(item.size for item in ordered if item.direction == "SELL")
    volume_imbalance = (buy_size - sell_size) / total_size if total_size else 0.0

    reasons: list[str] = [
        f"realized print range {realized_range_pct:.2f}%",
        f"print momentum {momentum_pct:.2f}%",
        f"volume imbalance {volume_imbalance:.2f}",
    ]
    if realized_range_pct >= 8.0:
        regime = "high_volatility"
        reasons.append("range exceeds high-volatility threshold")
    elif momentum_pct >= 1.0 and volume_imbalance >= 0.10 and spot_price >= vwap:
        regime = "trend_up"
        reasons.append("upward print momentum with buy imbalance and spot above VWAP")
    elif momentum_pct <= -1.0 and volume_imbalance <= -0.10 and spot_price <= vwap:
        regime = "trend_down"
        reasons.append("downward print momentum with sell imbalance and spot below VWAP")
    else:
        regime = "range_bound"
        reasons.append("mixed prints favor range-bound or choppy conditions")

    if regime == "trend_up":
        trend_bias = "bullish"
    elif regime == "trend_down":
        trend_bias = "bearish"
    else:
        trend_bias = "neutral"

    return MarketRegime(
        symbol=sym,
        regime=regime,
        trend_bias=trend_bias,
        realized_range_pct=round(realized_range_pct, 2),
        momentum_pct=round(momentum_pct, 2),
        vwap=round(vwap, 2),
        volume_imbalance=round(volume_imbalance, 4),
        print_count=len(relevant),
        reasons=reasons,
    )
