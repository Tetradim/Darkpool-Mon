"""Darkpool Monitor Backend - Python server with FINRA API integration."""

import os
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Literal
from enum import Enum

from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel
from collections import defaultdict

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Darkpool Monitor API",
    description="Backend for real-time darkpool monitoring with FINRA OTC data",
    version="1.0.0",
)

# ============================================================================
# Circuit Breaker with Exponential Backoff
# ============================================================================

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"         # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    """Circuit breaker with exponential backoff."""
    
    def __init__(self, name: str, failure_threshold: int = 5, timeout: int = 30, max_backoff: int = 60):
        self.name = name
        self.failure_threshold = failure_threshold
        self.timeout = timeout  # seconds before retry
        self.max_backoff = max_backoff
        self.failures = 0
        self.state = CircuitState.CLOSED
        self.last_failure: datetime | None = None
        self.backoff_seconds = 1
    
    def record_failure(self):
        self.failures += 1
        self.last_failure = datetime.utcnow()
        if self.failures >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(f"Circuit {self.name} OPEN after {self.failures} failures")
    
    def record_success(self):
        self.failures = 0
        self.state = CircuitState.CLOSED
        self.backoff_seconds = 1
    
    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        
        if self.state == CircuitState.OPEN and self.last_failure:
            elapsed = (datetime.utcnow() - self.last_failure).total_seconds()
            if elapsed >= self.backoff_seconds:
                self.state = CircuitState.HALF_OPEN
                return True
            # Exponential backoff
            self.backoff_seconds = min(self.backoff_seconds * 2, self.max_backoff)
        
        return self.state == CircuitState.HALF_OPEN
    
    def get_status(self) -> dict:
        return {
            "name": self.name,
            "state": self.state.value,
            "failures": self.failures,
            "next_retry_seconds": self.backoff_seconds if self.state == CircuitState.OPEN else 0,
        }


# Circuit breakers for each provider
CIRCUITS = {
    "finra": CircuitBreaker("finra", failure_threshold=3, timeout=30, max_backoff=60),
    "polygon": CircuitBreaker("polygon", failure_threshold=5, timeout=60, max_backoff=120),
    "intrinio": CircuitBreaker("intrinio", failure_threshold=3, timeout=60, max_backoff=120),
}


def with_circuit_break(provider_name: str):
    """Decorator for circuit breaker protection."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            circuit = CIRCUITS.get(provider_name)
            if not circuit:
                return await func(*args, **kwargs)
            
            if not circuit.can_execute():
                raise HTTPException(503, f"Provider {provider_name} circuit OPEN. Retry in {circuit.backoff_seconds}s")
            
            try:
                result = await func(*args, **kwargs)
                circuit.record_success()
                return result
            except Exception as e:
                circuit.record_failure()
                raise
        
        return wrapper
    return decorator


@app.get("/health/circuit")
async def get_circuit_status():
    """Get circuit breaker status for all providers."""
    return {"providers": {name: c.get_status() for name, c in CIRCUITS.items()}}


@app.post("/health/circuit/{provider}/reset")
async def reset_circuit(provider: str):
    """Manually reset a circuit breaker."""
    if provider in CIRCUITS:
        CIRCUITS[provider].record_success()
        return {"status": "reset", "provider": provider}
    raise HTTPException(404, f"Provider {provider} not found")


# ============================================================================
# Provider Abstraction
# ============================================================================

class DataProvider:
    """Base class for data providers."""

    name: str = "base"

    async def fetch_otc_data(self, symbol: str | None, tier: str, is_ats: bool):
        raise NotImplementedError


class FINRAProvider(DataProvider):
    """FINRA OTC data provider - free public data."""

    name = "finra"

    async def fetch_otc_data(self, symbol: str | None, tier: str = "T1", is_ats: bool = True):
        """Fetch OTC data from FINRA API."""
        from finra_helper import aget_full_data

        data = await aget_full_data(symbol, tier, is_ats)
        return [
            {
                "symbol": item.get("issueSymbolIdentifier"),
                "share_quantity": item.get("totalWeeklyShareQuantity"),
                "trade_quantity": item.get("totalWeeklyTradeCount"),
                "update_date": item.get("lastUpdateDate"),
                "week_start": item.get("weekStartDate"),
            }
            for item in data
        ]


class PolygonProvider(DataProvider):
    """Polygon.io provider - requires API key."""

    name = "polygon"

    def __init__(self):
        self.api_key = os.getenv("POLYGON_API_KEY", "")

    async def fetch_otc_data(self, symbol: str | None, tier: str = "T1", is_ats: bool = True):
        """Fetch dark pool trades from Polygon.io (identifies via exchange codes)."""
        import httpx

        if not self.api_key:
            raise HTTPException(401, "Polygon API key not configured")

        # Polygon uses exchange metadata to identify dark pool trades
        # Q = CBOE, K = IEX, T = NYSE, A = AMEX, B = NASDAQ, M = CHX
        # Dark pools typically: FINRA ADF, FTID, G, X, Y, Z
        url = f"https://api.polygon.io/v3/ticks/{symbol}/ Trades"

        params = {
            "timestamp": "latest",
            "limit": 5000,
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=30.0,
            )

        if response.status_code == 200:
            data = response.json()
            return [
                {
                    "symbol": t.get("sym"),
                    "price": t.get("p"),
                    "size": t.get("s"),
                    "exchange": t.get("x"),
                    "timestamp": t.get("t"),
                }
                for t in data.get("results", [])
            ]
        return []


class IntrinioProvider(DataProvider):
    """Intrinio provider - requires API key."""

    name = "intrinio"

    def __init__(self):
        self.api_key = os.getenv("INTRINIO_API_KEY", "")

    async def fetch_otc_data(self, symbol: str | None, tier: str = "T1", is_ats: bool = True):
        """Fetch dark pool trades from Intrinio."""
        import httpx

        if not self.api_key:
            raise HTTPException(401, "Intrinio API key not configured")

        url = f"https://api.intrinio.com/securities/{symbol}/ trades"

        params = {"darkpool_only": True, "page_size": 5000}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=30.0,
            )

        if response.status_code == 200:
            data = response.json()
            return [
                {
                    "symbol": t.get("ticker"),
                    "price": t.get("price"),
                    "size": t.get("volume"),
                    "timestamp": t.get("last_updated"),
                }
                for t in data.get("trades", [])
            ]
        return []


# ============================================================================
# Provider Registry
# ============================================================================

PROVIDERS: dict[str, DataProvider] = {
    "finra": FINRAProvider(),
    "polygon": PolygonProvider(),
    "intrinio": IntrinioProvider(),
}


def get_provider(name: str) -> DataProvider:
    """Get a provider by name."""
    if name not in PROVIDERS:
        raise HTTPException(400, f"Unknown provider: {name}")
    return PROVIDERS[name]


# ============================================================================
# Models
# ============================================================================

class OTCAggregateQuery(BaseModel):
    """OTC Aggregate Query Parameters."""

    symbol: str | None = None
    tier: Literal["T1", "T2", "OTCE"] = "T1"
    is_ats: bool = True


class OTCAggregateResponse(BaseModel):
    """OTC Aggregate Response."""

    data: list[dict]
    provider: str
    symbol: str | None
    tier: str
    is_ats: bool
    fetched_at: str


class Transaction(BaseModel):
    """Individual transaction model."""

    id: str
    timestamp: str
    symbol: str
    direction: Literal["BUY", "SELL"]
    size: int  # in shares
    price: float
    value: float  # notional value


# ============================================================================
# Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Darkpool Monitor API",
        "version": "1.0.0",
        "docs": "/docs",
        "providers": list(PROVIDERS.keys()),
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/providers")
async def list_providers():
    """List available providers."""
    return [
        {"name": p.name, "has_api_key": bool(getattr(p, "api_key", False))}
        for p in PROVIDERS.values()
    ]


@app.get("/darkpool/otc", response_model=OTCAggregateResponse)
async def get_otc_aggregate(
    symbol: str | None = Query(None, description="Stock symbol (e.g., AAPL)"),
    provider: str = Query("finra", description="Data provider: finra, polygon, intrinio"),
    tier: Literal["T1", "T2", "OTCE"] = Query(
        "T1",
        description="T1=S&P500, T2=NMS, OTCE=OTC equities",
    ),
    is_ats: bool = Query(True, description="ATS data if true, Non-ATS otherwise"),
):
    """Get weekly OTC/dark pool aggregate data.

    T1: Securities in S&P 500, Russell 1000 and selected ETFs
    T2: All other NMS stocks
    OTCE: Over-the-counter equity securities
    """
    provider_obj = get_provider(provider)

    try:
        data = await provider_obj.fetch_otc_data(symbol, tier, is_ats)
    except Exception as e:
        raise HTTPException(500, f"Error fetching data: {str(e)}")

    return OTCAggregateResponse(
        data=data,
        provider=provider,
        symbol=symbol,
        tier=tier,
        is_ats=is_ats,
        fetched_at=datetime.utcnow().isoformat(),
    )


@app.get("/darkpool/trades")
async def get_recent_trades(
    symbol: str = Query(..., description="Stock symbol"),
    provider: str = Query("finra", description="Data provider"),
    limit: int = Query(100, ge=1, le=5000, description="Max results"),
):
    """Get recent dark pool trades for a symbol."""
    provider_obj = get_provider(provider)

    try:
        data = await provider_obj.fetch_otc_data(symbol, "T1", True)
    except Exception as e:
        raise HTTPException(500, f"Error fetching trades: {str(e)}")

    return {
        "symbol": symbol,
        "trades": data[:limit],
        "count": len(data[:limit]),
    }


@app.get("/visualization/area")
async def get_area_chart(
    symbol: str = Query("AAPL", description="Stock symbol"),
    provider: str = Query("finra", description="Data provider"),
    timeframe: int = Query(30, description="Days of history"),
):
    """Get Plotly-ready area chart for Grafana (Infinity compatible).
    
    Returns Plotly JSON for area chart showing buy/sell volume over time.
    Use with Grafana Infinity datasource or HTTP data source.
    """
    from finra_helper import aget_full_data
    
    # Get data
    data = await aget_full_data(symbol, "T1", True)
    
    # Transform to time series (aggregate by day)
    daily_data = {}
    for item in data:
        date = item.get("lastUpdateDate", "")
        if date:
            shares = item.get("totalWeeklyShareQuantity", 0)
            trades = item.get("totalWeeklyTradeCount", 0)
            if date in daily_data:
                daily_data[date]["shares"] += shares
                daily_data[date]["trades"] += trades
            else:
                daily_data[date] = {"shares": shares, "trades": trades}
    
    # Convert to sorted list
    sorted_dates = sorted(daily_data.keys())[-timeframe:]
    timestamps = []
    shares_data = []
    trades_data = []
    
    for date in sorted_dates:
        timestamps.append(date)
        shares_data.append(daily_data[date]["shares"])
        trades_data.append(daily_data[date]["trades"])
    
    # Plotly Area Chart JSON (Grafana Infinity compatible)
    return {
        "data": [
            {
                "x": timestamps,
                "y": shares_data,
                "type": "scatter",
                "mode": "lines",
                "fill": "tozeroy",
                "name": "Share Volume",
                "line": {"color": "#00d4ff", "width": 2},
                "fillcolor": "rgba(0, 212, 255, 0.3)",
            },
            {
                "x": timestamps,
                "y": trades_data,
                "type": "scatter",
                "mode": "lines",
                "fill": "tozeroy",
                "name": "Trade Count",
                "line": {"color": "#22c55e", "width": 2},
                "fillcolor": "rgba(34, 197, 94, 0.3)",
                "yaxis": "y2",
            },
        ],
        "layout": {
            "title": {"text": f"Darkpool Volume: {symbol}", "font": {"size": 16}},
            "xaxis": {"title": "Date", "showgrid": False},
            "yaxis": {
                "title": "Shares",
                "titlefont": {"color": "#00d4ff"},
                "tickfont": {"color": "#00d4ff"},
                "showgrid": True,
                "gridcolor": "rgba(255,255,255,0.1)",
            },
            "yaxis2": {
                "title": "Trades",
                "titlefont": {"color": "#22c55e"},
                "tickfont": {"color": "#22c55e"},
                "overlaying": "y",
                "side": "right",
                "showgrid": False,
            },
            "paper_bgcolor": "#1a1a2e",
            "plot_bgcolor": "#1a1a2e",
            "font": {"color": "#ffffff"},
            "showlegend": True,
            "legend": {"x": 0, "y": 1},
            "margin": {"l": 60, "r": 60, "t": 50, "b": 60},
        },
    }


@app.get("/visualization/bar")
async def get_bar_chart(
    symbol: str = Query(None, description="Stock symbol (optional for all)"),
    provider: str = Query("finra", description="Data provider"),
    limit: int = Query(10, description="Top N results"),
):
    """Get Plotly-ready bar chart for Grafana.
    
    Returns bar chart JSON - compatible with Infinity datasource.
    Shows top symbols by dark pool volume.
    """
    from finra_helper import aget_full_data
    
    data = await aget_full_data(symbol, "T1", True) if symbol else await aget_full_data(None, "T1", True)
    
    # Aggregate by symbol
    symbol_data = {}
    for item in data:
        sym = item.get("issueSymbolIdentifier", "")
        if sym:
            shares = item.get("totalWeeklyShareQuantity", 0)
            if sym in symbol_data:
                symbol_data[sym] += shares
            else:
                symbol_data[sym] = shares
    
    # Sort and limit
    sorted_symbols = sorted(symbol_data.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    symbols = [s[0] for s in sorted_symbols]
    values = [s[1] for s in sorted_symbols]
    
    # Plotly Bar Chart JSON
    return {
        "data": [
            {
                "x": symbols,
                "y": values,
                "type": "bar",
                "marker": {
                    "color": values,
                    "colorscale": [
                        [0, "rgba(0, 212, 255, 0.6)"],
                        [1, "rgba(0, 212, 255, 1)"],
                    ],
                },
                "text": values,
                "textposition": "outside",
                "textfont": {"color": "#ffffff"},
            },
        ],
        "layout": {
            "title": {"text": f"Top {limit} Dark Pool Symbols", "font": {"size": 16}},
            "xaxis": {"title": "Symbol", "showgrid": False},
            "yaxis": {
                "title": "Weekly Share Volume",
                "showgrid": True,
                "gridcolor": "rgba(255,255,255,0.1)",
            },
            "paper_bgcolor": "#1a1a2e",
            "plot_bgcolor": "#1a1a2e",
            "font": {"color": "#ffffff"},
            "margin": {"l": 60, "r": 40, "t": 50, "b": 60},
        },
    }


@app.get("/visualization/combined")
async def get_combined_chart(
    symbol: str = Query("AAPL", description="Stock symbol"),
    provider: str = Query("finra", description="Data provider"),
):
    """Get Plotly combined bar + line chart for Grafana.
    
    Returns combined chart with:
    - Bar chart: daily volume
    - Line chart: price/implied move
    
    This is the bar+line combo that OpenBB uses with Plotly.
    """
    from finra_helper import aget_full_data
    
    data = await aget_full_data(symbol, "T1", True)
    
    # Aggregate by date
    daily_data = {}
    for item in data:
        date = item.get("lastUpdateDate", "")
        if date:
            shares = item.get("totalWeeklyShareQuantity", 0)
            trades = item.get("totalWeeklyTradeCount", 0)
            if date in daily_data:
                daily_data[date]["shares"] += shares
                daily_data[date]["trades"] += trades
            else:
                daily_data[date] = {"shares": shares, "trades": trades}
    
    # Sort
    sorted_dates = sorted(daily_data.keys())
    shares = [daily_data[d]["shares"] for d in sorted_dates]
    trades = [daily_data[d]["trades"] for d in sorted_dates]
    
    # Combined Bar + Line (like OpenBB's charting)
    return {
        "data": [
            {
                "x": sorted_dates,
                "y": shares,
                "type": "bar",
                "name": "Volume",
                "marker": {"color": "rgba(0, 212, 255, 0.7)"},
            },
            {
                "x": sorted_dates,
                "y": trades,
                "type": "scatter",
                "mode": "lines+markers",
                "name": "Trades",
                "line": {"color": "#22c55e", "width": 3},
                "marker": {"size": 6},
                "yaxis": "y2",
            },
        ],
        "layout": {
            "title": {"text": f"{symbol}: Volume & Trades", "font": {"size": 18}},
            "barmode": "overlay",
            "xaxis": {"title": "Date"},
            "yaxis": {
                "title": "Volume",
                "titlefont": {"color": "#00d4ff"},
                "tickfont": {"color": "#00d4ff"},
            },
            "yaxis2": {
                "title": "Trades",
                "titlefont": {"color": "#22c55e"},
                "tickfont": {"color": "#22c55e"},
                "overlaying": "y",
                "side": "right",
            },
            "paper_bgcolor": "#1a1a2e",
            "plot_bgcolor": "#1a1a2e",
            "font": {"color": "#ffffff"},
            "showlegend": True,
        ],
    }


# ============================================================================
# Grafana Infinity Data Source Format
# ============================================================================

@app.get("/grafana/table")
async def get_grafana_table(
    symbol: str = Query(None, description="Stock symbol"),
    limit: int = Query(100, description="Max rows"),
):
    """Grafana Infinity compatible table format.
    
    Returns JSON in format that Grafana Infinity plugin can parse.
    Use: URL = /grafana/table?symbol=AAPL
    """
    from finra_helper import aget_full_data
    
    data = await aget_full_data(symbol, "T1", True) if symbol else await aget_full_data(None, "T1", True)
    
    # Return array of objects (Infinity-compatible)
    return [
        {
            "symbol": item.get("issueSymbolIdentifier"),
            "shares": item.get("totalWeeklyShareQuantity"),
            "trades": item.get("totalWeeklyTradeCount"),
            "date": item.get("lastUpdateDate"),
            "week": item.get("weekStartDate"),
        }
        for item in data[:limit]
    ]


@app.get("/grafana/timeseries")
async def get_grafana_timeseries(
    symbol: str = Query("AAPL", description="Stock symbol"),
):
    """Grafana timeseries compatible format.
    
    Returns data in Grafana-native timeseries format.
    """
    from finra_helper import aget_full_data
    
    data = await aget_full_data(symbol, "T1", True)
    
    # Aggregate by date
    daily_data = {}
    for item in data:
        date = item.get("lastUpdateDate", "")
        if date:
            shares = item.get("totalWeeklyShareQuantity", 0)
            if date in daily_data:
                daily_data[date] += shares
            else:
                daily_data[date] = shares
    
    # Return as array with timestamp
    return [
        {"timestamp": date, "value": daily_data[date], "metric": symbol}
        for date in sorted(daily_data.keys())
    ]

# ============================================================================
# VWAP / NBBO Analysis
# ============================================================================

class NBBOQuote(BaseModel):
    """National Best Bid and Offer."""

    symbol: str
    bid: float
    ask: float
    bid_size: int
    ask_size: int
    timestamp: str


class TradePrint(BaseModel):
    """Individual trade print."""

    symbol: str
    price: float
    size: int
    is_buy: bool  # True = buy, False = sell
    vwap: float | None = None
    is_aggressive: bool | None = None  # Above ask or below bid
    source: str  # exchange


@app.get("/nbbo/quote")
async def get_nbbo_quote(
    symbol: str = Query(..., description="Stock symbol"),
    provider: str = Query("finra", description="Data provider"),
):
    """Get current NBBO quote for a symbol.
    
    Returns bid/ask from all exchanges with size.
    """
    import httpx

    if provider == "polygon":
        api_key = os.getenv("POLYGON_API_KEY", "")
        if not api_key:
            raise HTTPException(401, "Polygon API key not configured")

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.polygon.io/v3/quotes/{symbol}",
                params={"timestamp": "now"},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=30,
            )

        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            if results:
                # Find best bid and ask
                best_bid = {"price": 0, "size": 0}
                best_ask = {"price": float("inf"), "size": 0}

                for q in results:
                    if q.get("side") == "bid":
                        if q.get("price", 0) > best_bid["price"]:
                            best_bid = {"price": q.get("price"), "size": q.get("size")}
                    else:
                        if q.get("price", float("inf")) < best_ask["price"]:
                            best_ask = {"price": q.get("price"), "size": q.get("size")}

                return {
                    "symbol": symbol,
                    "bid": best_bid["price"],
                    "bid_size": best_bid["size"],
                    "ask": best_ask["price"],
                    "ask_size": best_ask["size"],
                    "mid": (best_bid["price"] + best_ask["price"]) / 2,
                    "spread": best_ask["price"] - best_bid["price"],
                    "spread_bps": (best_ask["price"] - best_bid["price"]) / best_bid["price"] * 10000
                    if best_bid["price"] > 0 else 0,
                    "timestamp": results[0].get("timestamp"),
                }

    # Fallback: Generate synthetic NBBO for demo
    from dataGenerator import MAG7_STOCKS

    stock = MAG7_STOCKS.get(symbol.upper(), {"basePrice": 100})
    price = stock.get("basePrice", 100)
    spread = price * 0.001  # 10 bps spread

    return {
        "symbol": symbol.upper(),
        "bid": round(price - spread / 2, 2),
        "bid_size": 10000,
        "ask": round(price + spread / 2, 2),
        "ask_size": 10000,
        "mid": price,
        "spread": round(spread, 2),
        "spread_bps": 10,
        "timestamp": datetime.utcnow().isoformat(),
        "_note": "Synthetic (configure Polygon API key for real data)",
    }


@app.get("/nbbo/trades")
async def get_nbbo_trades(
    symbol: str = Query(..., description="Stock symbol"),
    provider: str = Query("finra", description="Data provider"),
    limit: int = Query(100, description="Max trades"),
):
    """Get dark pool trades compared against NBBO.
    
    Shows aggressive prints:
    - BUY above ask = aggressive buying (taking liquidity)
    - SELL below bid = aggressive selling (hitting liquidity)
    
    Calculates VWAP and sentiment.
    """
    import httpx

    # Get NBBO first
    nbbo = await get_nbbo_quote(symbol, provider)
    bid = nbbo["bid"]
    ask = nbbo["ask"]
    mid = nbbo["mid"]

    # Get trades
    if provider == "polygon":
        api_key = os.getenv("POLYGON_API_KEY", "")
        if api_key:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://api.polygon.io/v3/ticks/{symbol}/trades",
                    params={"limit": limit, "timestamp": "now"},
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=30,
                )

            if resp.status_code == 200:
                data = resp.json()
                trades = []
                total_vwap = 0
                buy_count = 0
                sell_count = 0

                for t in data.get("results", []):
                    price = t.get("p", 0)
                    size = t.get("s", 0)
                    exchange = t.get("x", "")

                    # Determine if buy or sell based on price vs NBBO
                    if price >= ask:
                        direction = "BUY"
                        is_aggressive = True
                    elif price <= bid:
                        direction = "SELL"
                        is_aggressive = True
                    else:
                        # Passive - between bid and ask
                        if price >= mid:
                            direction = "BUY"
                        else:
                            direction = "SELL"
                        is_aggressive = False

                    if direction == "BUY":
                        buy_count += 1
                    else:
                        sell_count += 1

                    total_vwap += price * size

                    trades.append({
                        "symbol": symbol,
                        "price": price,
                        "size": size,
                        "direction": direction,
                        "is_aggressive": is_aggressive,
                        "exchange": exchange,
                        "timestamp": t.get("t"),
                    })

                # Calculate overall VWAP
                total_size = sum(t["size"] for t in trades)
                vwap = total_vwap / total_size if total_size > 0 else 0

                return {
                    "symbol": symbol,
                    "nbbo": {"bid": bid, "ask": ask, "mid": mid},
                    "trades": trades[:limit],
                    "summary": {
                        "total_trades": len(trades),
                        "buy_count": buy_count,
                        "sell_count": sell_count,
                        "buy_ratio": buy_count / len(trades) if trades else 0.5,
                        "aggressive_count": sum(1 for t in trades if t["is_aggressive"]),
                        "vwap": vwap,
                        "vwap_vs_mid": (vwap - mid) / mid * 100 if mid > 0 else 0,
                    },
                }

    # Fallback: Generate synthetic trades
    import random
    from dataGenerator import generateTransaction

    trades = []
    total_vwap = 0
    total_size = 0
    buy_count = 0
    sell_count = 0
    aggressive_count = 0

    for _ in range(min(limit, 50)):
        tx = generateTransaction()
        if tx["symbol"] != symbol.upper():
            continue

        price = tx["price"]
        size = tx["size"]
        direction = tx["direction"]

        # Determine aggression based on price vs NBBO
        if direction == "BUY":
            is_aggressive = price >= ask
            buy_count += 1
        else:
            is_aggressive = price <= bid
            sell_count += 1

        if is_aggressive:
            aggressive_count += 1

        total_vwap += price * size
        total_size += size

        trades.append({
            "symbol": tx["symbol"],
            "price": price,
            "size": size,
            "direction": direction,
            "is_aggressive": is_aggressive,
            "exchange": "SYNTH",
            "timestamp": datetime.utcnow().isoformat(),
        })

    vwap = total_vwap / total_size if total_size > 0 else 0

    return {
        "symbol": symbol,
        "nbbo": {"bid": bid, "ask": ask, "mid": mid},
        "trades": trades[:limit],
        "summary": {
            "total_trades": len(trades),
            "buy_count": buy_count,
            "sell_count": sell_count,
            "buy_ratio": buy_count / len(trades) if trades else 0.5,
            "aggressive_count": aggressive_count,
            "vwap": round(vwap, 2),
            "vwap_vs_mid": round((vwap - mid) / mid * 100, 2),
        },
        "_note": "Synthetic (configure Polygon API key for real data)",
    }


@app.get("/vwap/analysis")
async def get_vwap_analysis(
    symbol: str = Query(..., description="Stock symbol"),
    lookback: int = Query(30, description="Number of trades"),
):
    """Get VWAP analysis with NBBO comparison.
    
    Returns:
    - VWAP: Volume Weighted Average Price
    - VWAP vs Mid: % premium/discount to NBBO mid
    - Aggressive ratio: % of trades taking liquidity
    - Sentiment: BULLISH/BEARING/NEUTRAL
    """
    # Get trades with NBBO
    result = await get_nbbo_trades(symbol, "polygon" if os.getenv("POLYGON_API_KEY") else "finra", lookback)

    summary = result.get("summary", {})
    vwap = summary.get("vwap", 0)
    vwap_vs_mid = summary.get("vwap_vs_mid", 0)
    buy_ratio = summary.get("buy_ratio", 0.5)
    aggressive_ratio = summary.get("aggressive_count", 0) / summary.get("total_trades", 1)

    # Determine sentiment
    if vwap_vs_mid > 0.1 and buy_ratio > 0.6:
        sentiment = "BULLISH"
        emoji = "🐂"
    elif vwap_vs_mid < -0.1 and buy_ratio < 0.4:
        sentiment = "BEARISH"
        emoji = "🐻"
    else:
        sentiment = "NEUTRAL"
        emoji = "⚖️"

    return {
        "symbol": symbol,
        "analysis": {
            "vwap": round(vwap, 2),
            "vwap_vs_mid_pct": round(vwap_vs_mid, 2),
            "buy_ratio": round(buy_ratio * 100, 1),
            "aggressive_ratio": round(aggressive_ratio * 100, 1),
            "sentiment": sentiment,
            "emoji": emoji,
            "interpretation": f"{sentiment} sentiment: VWAP {('above' if vwap_vs_mid > 0 else 'below')} mid by {abs(vwap_vs_mid):.2f}%" if abs(vwap_vs_mid) > 0.01 else "Near fair value",
        },
        "nbbo": result.get("nbbo"),
    }

# ============================================================================
# Order Book Imbalance
# ============================================================================

# Import for orderbook
from collections import defaultdict

@app.get("/orderbook/imbalance")
async def get_orderbook_imbalance(
    symbol: str = Query(..., description="Stock symbol"),
    levels: int = Query(10, description="Order book levels"),
):
    """Get order book imbalance analysis.
    
    Shows:
    - Bid/Ask size imbalance
    - Cumulative depth at each level  
    - Order book pressure indicator
    """
    from dataGenerator import MAG7_STOCKS
    
    stock = MAG7_STOCKS.get(symbol.upper(), {"basePrice": 100})
    mid = stock.get("basePrice", 100)
    
    # Generate synthetic order book
    bid_levels = []
    ask_levels = []
    
    for i in range(levels):
        bid_px = mid - (i + 1) * 0.05
        bid_size = int(50000 * (1 + i * 0.2) * (0.9 + 0.2 * (i % 3)))
        bid_levels.append({"price": round(bid_px, 2), "size": bid_size})
        
        ask_px = mid + (i + 1) * 0.05
        ask_size = int(50000 * (1 + i * 0.2) * (0.9 + 0.2 * ((i + 1) % 3)))
        ask_levels.append({"price": round(ask_px, 2), "size": ask_size})
    
    # Calculate imbalance
    bid_total = sum(b["size"] for b in bid_levels)
    ask_total = sum(a["size"] for a in ask_levels)
    total = bid_total + ask_total
    
    imbalance = (bid_total - ask_total) / total if total > 0 else 0
    
    # Calculate pressure
    if imbalance > 0.3:
        pressure = "BUY_BIAS"
        emoji = "🟢"
    elif imbalance < -0.3:
        pressure = "SELL_BIAS"
        emoji = "🔴"
    else:
        pressure = "BALANCED"
        emoji = "⚖️"
    
    # Cumulative imbalance at each level
    imbalance_levels = []
    cum_bid = 0
    cum_ask = 0
    
    for i in range(min(len(bid_levels), len(ask_levels))):
        cum_bid += bid_levels[i]["size"]
        cum_ask += ask_levels[i]["size"]
        level_imbalance = (cum_bid - cum_ask) / (cum_bid + cum_ask) if (cum_bid + cum_ask) > 0 else 0
        imbalance_levels.append({
            "level": i + 1,
            "bid_cum": cum_bid,
            "ask_cum": cum_ask,
            "imbalance": round(level_imbalance, 3),
        })
    
    return {
        "symbol": symbol.upper(),
        "source": "synthetic",
        "metrics": {
            "bid_total": bid_total,
            "ask_total": ask_total,
            "imbalance_ratio": round(imbalance, 3),
            "pressure": pressure,
            "emoji": emoji,
        },
        "levels": imbalance_levels[:5],
        "interpretation": f"Order book {pressure}: {imbalance*100:+.1f}% bid bias",
    }


# ============================================================================
# Volume Profile
# ============================================================================

@app.get("/volume/profile")
async def get_volume_profile(
    symbol: str = Query(..., description="Stock symbol"),
    bins: int = Query(20, description="Price bins"),
):
    """Get volume profile analysis."""
    import random
    from dataGenerator import MAG7_STOCKS
    
    stock = MAG7_STOCKS.get(symbol.upper(), {"basePrice": 100})
    mid = stock.get("basePrice", 100)
    
    random.seed(hash(symbol.upper()))
    profile = []
    
    for i in range(bins):
        bin_low = mid - 10 + (i * (20 / bins))
        bin_high = bin_low + (20 / bins)
        vol = int(100000 * (1 + 2 * (1 - abs(i - bins/2) / (bins/1))) + random.randint(-10000, 10000)
        profile.append({
            "bin": i + 1,
            "price_low": round(bin_low, 2),
            "price_high": round(bin_high, 2),
            "volume": max(0, vol),
        })
    
    profile_sorted = sorted(profile, key=lambda x: x["volume"], reverse=True)
    total_vol = sum(p["volume"] for p in profile)
    vpoc = profile_sorted[0]
    
    # Value area (70%)
    va_vol = 0
    va_target = total_vol * 0.70
    value_area = []
    for p in profile_sorted:
        if va_vol >= va_target:
            break
        value_area.append(p)
        va_vol += p["volume"]
    
    return {
        "symbol": symbol.upper(),
        "source": "synthetic",
        "analysis": {
            "vpoc_price": vpoc["price_low"],
            "vpoc_volume": vpoc["volume"],
            "total_volume": total_vol,
            "value_area": {"low": min(va["price_low"] for va in value_area), "high": max(va["price_high"] for va in value_area), "volume_pct": 70},
        },
    }


# ============================================================================
# Time-of-Day Sentiment
# ============================================================================

@app.get("/sentiment/timeofday")
async def get_timeofday_sentiment(symbol: str = Query(...)):
    """Get time-of-day sentiment."""
    now = datetime.utcnow()
    et_hour = (now.hour - 4) % 24
    
    if 4 <= et_hour < 9:
        session, name, desc, rec = "pre", "Pre-Market", "4:00 - 9:30 AM ET", "Cautious"
    elif 9 <= et_hour < 16:
        session, name, desc, rec = "regular", "Regular Hours", "9:30 AM - 4:00 PM ET", "Trade"
    elif 16 <= et_hour < 20:
        session, name, desc, rec = "after", "After Hours", "4:00 - 8:00 PM ET", "Cautious"
    else:
        session, name, desc, rec = "closed", "Market Closed", "8:00 PM - 4:00 AM ET", "Wait"
    
    return {"symbol": symbol.upper(), "session": session, "session_info": {"name": name, "description": desc}, "recommendation": rec, "et_timestamp": now.isoformat()}


# ============================================================================
# Complete Analysis
# ============================================================================

@app.get("/analysis/complete")
async def get_complete_analysis(symbol: str = Query("AAPL")):
    """Get complete analysis."""
    # Get all components
    vwap = await get_vwap_analysis(symbol, 30)
    ob = await get_orderbook_imbalance(symbol, 10)
    vol = await get_volume_profile(symbol, 20)
    tod = await get_timeofday_sentiment(symbol)
    
    # Combine signals
    signals = [
        {"source": "vwap", "value": vwap.get("analysis", {}).get("sentiment", "NEUTRAL"), "weight": 0.3},
        {"source": "orderbook", "value": ob.get("metrics", {}).get("pressure", "BALANCED"), "weight": 0.25},
        {"source": "timeofday", "value": "BULLISH" if tod.get("recommendation") == "Trade" else "NEUTRAL", "weight": 0.15},
    ]
    
    bullish = sum(1 for s in signals if s["value"] in ["BULLISH", "BUY_BIAS"])
    bearish = sum(1 for s in signals if s["value"] in ["BEARISH", "SELL_BIAS"])
    
    if bullish > bearish:
        overall, emoji = "BULLISH", "🐂"
    elif bearish > bullish:
        overall, emoji = "BEARISH", "🐻"
    else:
        overall, emoji = "NEUTRAL", "⚖️"
    
    return {"symbol": symbol.upper(), "generated_at": datetime.utcnow().isoformat(), "overall_sentiment": overall, "emoji": emoji, "signals": signals, "components": {"vwap": vwap.get("analysis"), "orderbook": ob.get("metrics"), "volume_profile": vol.get("analysis"), "timeofday": tod}}


# ============================================================================
# Whale Threshold Alerts
# ============================================================================

class WhaleAlertConfig(BaseModel):
    """Whale alert configuration."""

    symbol: str
    min_shares: int = 50000
    min_dollars: int = 1_000_000  # $1M default
    active: bool = True
    webhook_url: str | None = None


# In-memory alert store (use Redis/DB in production)
WHALE_ALERTS: dict[str, dict] = {}


@app.get("/alerts/config")
async def get_alert_configs():
    """Get all whale alert configurations."""
    return {"alerts": list(WHALE_ALERTS.values())}


@app.post("/alerts/config")
async def create_alert_config(config: WhaleAlertConfig):
    """Create a whale alert configuration."""
    WHALE_ALERTS[config.symbol.upper()] = {
        "symbol": config.symbol.upper(),
        "min_shares": config.min_shares,
        "min_dollars": config.min_dollars,
        "active": config.active,
        "webhook_url": config.webhook_url,
        "created_at": datetime.utcnow().isoformat(),
    }
    return {"status": "created", "alert": WHALE_ALERTS[config.symbol.upper()]}


@app.delete("/alerts/config/{symbol}")
async def delete_alert_config(symbol: str):
    """Delete a whale alert configuration."""
    if symbol.upper() in WHALE_ALERTS:
        del WHALE_ALERTS[symbol.upper()]
        return {"status": "deleted", "symbol": symbol.upper()}
    raise HTTPException(404, f"Alert for {symbol} not found")


@app.get("/alerts/check")
async def check_whale_alert(
    symbol: str = Query(..., description="Stock symbol"),
    shares: int = Query(..., description="Trade size in shares"),
    price: float = Query(..., description="Trade price"),
):
    """Check if a trade triggers whale alert."""
    import httpx

    notional = shares * price
    triggered = False
    alert_level = None

    # Check against config
    config = WHALE_ALERTS.get(symbol.upper(), {"min_shares": 50000, "min_dollars": 1000000, "active": True})

    if not config.get("active", True):
        return {"triggered": False, "reason": "Alert disabled"}

    if shares >= config.get("min_shares", 50000):
        triggered = True
        alert_level = "shares"
    elif notional >= config.get("min_dollars", 1000000):
        triggered = True
        alert_level = "dollars"

    # Send webhook if triggered
    if triggered and config.get("webhook_url"):
        embed = {
            "title": f"🐋 WHALE ALERT: {symbol.upper()}",
            "description": f"**{shares:,} shares** @ ${price:.2f}",
            "color": 0xFF6B00,
            "fields": [
                {"name": "Notional Value", "value": f"${notional:,.0f}", "inline": True},
                {"name": "Triggered By", "value": alert_level, "inline": True},
                {"name": "Threshold", "value": f"{config.get('min_shares'):,} shares or ${config.get('min_dollars'):,}", "inline": True},
            ],
            "timestamp": datetime.utcnow().isoformat(),
        }

        payload = {
            "content": "🐋 **WHALE ALERT**",
            "embeds": [embed],
        }

        async with httpx.AsyncClient() as client:
            await client.post(config["webhook_url"], json=payload, timeout=10.0)

    return {
        "triggered": triggered,
        "reason": f"{alert_level} threshold exceeded" if triggered else "No threshold exceeded",
        "notional": notional,
        "symbol": symbol.upper(),
        "shares": shares,
        "price": price,
        "config": config,
    }


@app.get("/alerts/whale-feed")
async def get_whale_feed(
    symbol: str = Query(None, description="Stock symbol filter"),
    min_shares: int = Query(50000, description="Minimum shares"),
    min_dollars: int = Query(1000000, description="Minimum dollars"),
    limit: int = Query(100, description="Max results"),
):
    """Get recent whale activity feed."""
    from dataGenerator import generateTransaction, MAG7_STOCKS

    # Generate transactions and filter
    whales = []
    for _ in range(limit * 3):
        tx = generateTransaction()
        notional = tx["size"] * tx["price"]

        # Apply filters
        if symbol and tx["symbol"] != symbol.upper():
            continue
        if tx["size"] < min_shares and notional < min_dollars:
            continue

        whales.append({
            "id": tx["id"],
            "symbol": tx["symbol"],
            "direction": tx["direction"],
            "shares": tx["size"],
            "price": tx["price"],
            "notional": notional,
            "timestamp": tx["timestamp"].isoformat(),
            "is_whale": True,
        })

    return {
        "whales": whales[:limit],
        "count": len(whales[:limit]),
        "filters": {"symbol": symbol, "min_shares": min_shares, "min_dollars": min_dollars},
    }


# ============================================================================
# Discord Bot Webhook Endpoint
# ============================================================================

class AlertWebhook(BaseModel):
    """Webhook alert payload."""

    symbol: str
    direction: Literal["BUY", "SELL"]
    size: int
    price: float
    alert_type: Literal["whale", "anomaly", "level"]


@app.post("/alerts/webhook")
async def send_alertWebhook(
    webhook_url: str = Query(..., description="Discord webhook URL"),
    alert: AlertWebhook,
):
    """Send an alert to Discord webhook."""
    import httpx

    embed = {
        "title": f"🚨 Darkpool Alert: {alert.symbol}",
        "description": f"**{alert.direction}** {alert.size:,} shares @ ${alert.price:.2f}",
        "color": 0x00FF00 if alert.direction == "BUY" else 0xFF0000,
        "fields": [
            {"name": "Type", "value": alert.alert_type, "inline": True},
            {"name": "Notional", "value": f"${alert.size * alert.price:,.0f}", "inline": True},
        ],
        "timestamp": datetime.utcnow().isoformat(),
    }

    payload = {
        "content": f"Darkpool {'🐋 Whale' if alert.alert_type == 'whale' else '📊'} Alert",
        "embeds": [embed],
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(webhook_url, json=payload, timeout=10.0)

    if response.status_code == 204:
        return {"status": "sent"}
    raise HTTPException(response.status_code, "Failed to send webhook")


# ============================================================================
# Slash Command Handler
# ============================================================================

class SlashCommand(BaseModel):
    """Discord slash command payload."""

    id: str
    type: int
    data: dict
    member: dict | None = None
    guild_id: str | None = None
    channel_id: str | None = None


@app.post("/discord/commands")
async def handle_slash_command(command: SlashCommand):
    """Handle Discord slash commands."""
    from finra_helper import aget_full_data

    cmd_name = command.data.get("name", "")
    options = {opt["name"]: opt.get("value") for opt in command.data.get("options", [])}

    if cmd_name == "darkpool":
        symbol = options.get("symbol")
        tier = options.get("tier", "T1")
        data = await aget_full_data(symbol, tier, True) if symbol else []
        return {"type": 4, "data": {"content": f"📊 Darkpool Data for {symbol or 'ALL'}: {len(data):,} records (Tier {tier})"}}

    return {"type": 4, "data": {"content": "Unknown command"}}


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)