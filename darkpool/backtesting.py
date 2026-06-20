"""Lightweight strategy-readiness metrics for recent prints."""

from __future__ import annotations

from .models import BacktestSummary, BacktestTrade, DarkpoolPrint


def _trade_return_pct(current: DarkpoolPrint, next_print: DarkpoolPrint, fee_bps: float) -> float:
    price_change_pct = (next_print.price - current.price) / current.price * 100
    if current.direction == "SELL":
        price_change_pct *= -1
    return round(price_change_pct - (fee_bps / 100), 4)


def build_print_followthrough_backtest(
    symbol: str,
    provider: str,
    prints: list[DarkpoolPrint],
    fee_bps: float = 2.0,
    limit: int = 50,
) -> BacktestSummary:
    """Evaluate whether print-side bias had immediate follow-through.

    This is not a full exchange simulator. It gives operators a quick sanity
    check on recent signal quality before trusting any bot gate.
    """
    sym = symbol.upper()
    ordered = sorted(
        [item for item in prints if item.symbol.upper() == sym and item.direction in {"BUY", "SELL"}],
        key=lambda item: item.timestamp,
    )
    trades: list[BacktestTrade] = []
    for current, next_print in zip(ordered, ordered[1:]):
        if len(trades) >= limit:
            break
        gross_return_pct = (next_print.price - current.price) / current.price * 100
        if current.direction == "SELL":
            gross_return_pct *= -1
        trades.append(
            BacktestTrade(
                symbol=sym,
                side=current.direction,
                entry_price=current.price,
                exit_price=next_print.price,
                gross_return_pct=round(gross_return_pct, 4),
                net_return_pct=_trade_return_pct(current, next_print, fee_bps),
                timestamp=current.timestamp,
            )
        )

    if not trades:
        return BacktestSummary(
            symbol=sym,
            provider=provider,
            trade_count=0,
            win_rate_pct=0.0,
            profit_factor=None,
            expectancy_pct=0.0,
            cumulative_return_pct=0.0,
            max_drawdown_pct=0.0,
            average_win_pct=0.0,
            average_loss_pct=0.0,
            fee_bps=fee_bps,
            warning="insufficient directional prints for follow-through backtest",
            trades=[],
        )

    returns = [trade.net_return_pct for trade in trades]
    wins = [value for value in returns if value > 0]
    losses = [value for value in returns if value < 0]
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    equity = 0.0
    peak = 0.0
    max_drawdown = 0.0
    for value in returns:
        equity += value
        peak = max(peak, equity)
        max_drawdown = max(max_drawdown, peak - equity)

    return BacktestSummary(
        symbol=sym,
        provider=provider,
        trade_count=len(trades),
        win_rate_pct=round(len(wins) / len(trades) * 100, 2),
        profit_factor=round(gross_profit / gross_loss, 2) if gross_loss > 0 else None,
        expectancy_pct=round(sum(returns) / len(returns), 4),
        cumulative_return_pct=round(sum(returns), 4),
        max_drawdown_pct=round(max_drawdown, 4),
        average_win_pct=round(sum(wins) / len(wins), 4) if wins else 0.0,
        average_loss_pct=round(sum(losses) / len(losses), 4) if losses else 0.0,
        fee_bps=fee_bps,
        warning="print follow-through metrics are historical and do not predict future returns",
        trades=trades,
    )
