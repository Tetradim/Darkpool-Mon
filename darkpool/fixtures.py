"""Deterministic demo data for offline operation and tests."""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta, timezone
from typing import Iterable

from .models import DarkpoolPrint, ExposureNode, OptionsFlowSignal, StockInfo


MAG7_STOCKS: dict[str, dict] = {
    "NVDA": {"symbol": "NVDA", "name": "NVIDIA", "basePrice": 875.50, "weight": 0.18, "sector": "Semiconductors", "etf": "SMH"},
    "AAPL": {"symbol": "AAPL", "name": "Apple", "basePrice": 178.25, "weight": 0.16, "sector": "Technology", "etf": "QQQ"},
    "MSFT": {"symbol": "MSFT", "name": "Microsoft", "basePrice": 415.80, "weight": 0.15, "sector": "Technology", "etf": "QQQ"},
    "GOOGL": {"symbol": "GOOGL", "name": "Alphabet", "basePrice": 175.60, "weight": 0.14, "sector": "Communication Services", "etf": "QQQ"},
    "AMZN": {"symbol": "AMZN", "name": "Amazon", "basePrice": 185.40, "weight": 0.14, "sector": "Consumer Discretionary", "etf": "QQQ"},
    "META": {"symbol": "META", "name": "Meta", "basePrice": 525.75, "weight": 0.12, "sector": "Communication Services", "etf": "QQQ"},
    "TSLA": {"symbol": "TSLA", "name": "Tesla", "basePrice": 175.20, "weight": 0.11, "sector": "Consumer Discretionary", "etf": "QQQ"},
}


def get_stock(symbol: str) -> dict:
    return MAG7_STOCKS.get(symbol.upper(), {"symbol": symbol.upper(), "name": symbol.upper(), "basePrice": 100.0, "weight": 1.0})


def stable_random(*parts: object) -> random.Random:
    seed = hashlib.sha256("|".join(str(part) for part in parts).encode("utf-8")).hexdigest()
    return random.Random(int(seed[:16], 16))


def weighted_stock(rng: random.Random | None = None) -> dict:
    rng = rng or random
    stocks = list(MAG7_STOCKS.values())
    total = sum(float(stock["weight"]) for stock in stocks)
    cursor = rng.random() * total
    for stock in stocks:
        cursor -= float(stock["weight"])
        if cursor <= 0:
            return stock
    return stocks[-1]


def generateTransaction(stockData: dict | None = None) -> dict:
    """Compatibility helper for legacy server routes."""
    rng = stable_random(datetime.now(timezone.utc).timestamp(), random.random())
    stock = stockData or weighted_stock(rng)
    base_price = float(stock.get("basePrice", 100.0))
    size = int(rng.randint(10_000, 650_000))
    direction = "BUY" if rng.random() >= 0.48 else "SELL"
    price = round(base_price * (1 + rng.uniform(-0.006, 0.006)), 2)
    return {
        "id": f"TXN-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{rng.randrange(100000, 999999)}",
        "symbol": stock["symbol"],
        "name": stock.get("name", stock["symbol"]),
        "size": size,
        "price": price,
        "value": round(size * price, 2),
        "direction": direction,
        "timestamp": datetime.now(timezone.utc),
    }


def sample_darkpool_prints(symbol: str | None = None, limit: int = 160) -> list[DarkpoolPrint]:
    symbols = [symbol.upper()] if symbol else list(MAG7_STOCKS)
    prints: list[DarkpoolPrint] = []
    now = datetime.now(timezone.utc)

    for sym in symbols:
        stock = get_stock(sym)
        rng = stable_random("prints", sym)
        base = float(stock["basePrice"])
        anchor_offsets = [-0.035, -0.015, 0.0, 0.018, 0.042]
        for idx in range(max(1, limit // len(symbols))):
            anchor = base * (1 + anchor_offsets[idx % len(anchor_offsets)])
            price = round(anchor + rng.uniform(-0.09, 0.09), 2)
            size = rng.randint(15_000, 750_000)
            direction = "BUY" if rng.random() >= 0.5 else "SELL"
            prints.append(
                DarkpoolPrint(
                    id=f"{sym}-{idx}",
                    symbol=sym,
                    price=max(0.01, price),
                    size=size,
                    direction=direction,
                    venue=rng.choice(["ATS", "TRF", "DARK", "FINRA"]),
                    timestamp=now - timedelta(minutes=rng.randint(1, 390)),
                )
            )

    prints.sort(key=lambda item: item.notional, reverse=True)
    return prints[:limit]


def sample_exposure_nodes(symbol: str, spot_price: float | None = None) -> list[ExposureNode]:
    stock = get_stock(symbol)
    spot = spot_price or float(stock["basePrice"])
    rng = stable_random("exposure", symbol)
    now = datetime.now(timezone.utc)
    nodes: list[ExposureNode] = []
    for pct in [-0.05, -0.025, -0.01, 0.0125, 0.03, 0.055]:
        price = round(spot * (1 + pct), 2)
        magnitude = rng.uniform(250_000, 4_500_000)
        sign = -1 if pct < -0.015 and rng.random() > 0.45 else 1
        nodes.append(
            ExposureNode(
                symbol=symbol.upper(),
                price=price,
                exposure=round(magnitude * sign, 2),
                kind="GEX" if rng.random() >= 0.35 else "VEX",
                expires_at=None,
                updated_at=now - timedelta(minutes=rng.randint(1, 45)),
            )
        )
    return nodes


def sample_options_flow(symbol: str) -> list[OptionsFlowSignal]:
    rng = stable_random("flow", symbol)
    return [
        OptionsFlowSignal(
            symbol=symbol.upper(),
            direction=rng.choice(["BULLISH", "BEARISH", "MIXED"]),
            premium=round(rng.uniform(250_000, 4_000_000), 2),
            contracts=rng.randint(25, 800),
            aggressor=rng.random() > 0.45,
        )
        for _ in range(4)
    ]


def stock_symbols(symbol: str | None = None) -> list[str]:
    return [symbol.upper()] if symbol else list(MAG7_STOCKS)

