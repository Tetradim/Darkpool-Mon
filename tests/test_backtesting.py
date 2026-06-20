from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

import server
from darkpool.backtesting import build_print_followthrough_backtest
from darkpool.models import DarkpoolPrint


def _print(idx: int, price: float, direction: str) -> DarkpoolPrint:
    return DarkpoolPrint(
        id=f"AAPL-{idx}",
        symbol="AAPL",
        price=price,
        size=1000,
        direction=direction,
        venue="ATS",
        timestamp=datetime.now(timezone.utc) + timedelta(minutes=idx),
    )


def test_print_followthrough_backtest_calculates_core_metrics():
    summary = build_print_followthrough_backtest(
        "AAPL",
        "demo",
        [
            _print(0, 100.0, "BUY"),
            _print(1, 102.0, "SELL"),
            _print(2, 101.0, "BUY"),
            _print(3, 103.0, "BUY"),
        ],
        fee_bps=0,
    )

    assert summary.trade_count == 3
    assert summary.win_rate_pct == 100.0
    assert summary.profit_factor is None
    assert summary.cumulative_return_pct > 0
    assert summary.max_drawdown_pct == 0.0
    assert summary.trades[0].side == "BUY"
    assert summary.trades[1].side == "SELL"


def test_backtest_endpoint_returns_followthrough_metrics():
    client = TestClient(server.app)

    response = client.get("/darkpool/backtest?symbol=AAPL&provider=demo&fee_bps=2&trade_limit=10")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["symbol"] == "AAPL"
    assert body["summary"]["trade_count"] <= 10
    assert "win_rate_pct" in body["summary"]
    assert "max_drawdown_pct" in body["summary"]
