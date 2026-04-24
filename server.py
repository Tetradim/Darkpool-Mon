"""Darkpool Monitor Backend - Python server with FINRA API integration."""

import os
from datetime import datetime, timedelta
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel

load_dotenv()

app = FastAPI(
    title="Darkpool Monitor API",
    description="Backend for real-time darkpool monitoring with FINRA OTC data",
    version="1.0.0",
)

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
# Slash Command Handler (for Discord interaction)
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
        result_count = len(data)

        return {
            "type": 4,  # CHANNEL_MESSAGE_WITH_SOURCE
            "data": {
                "content": f"📊 Darkpool Data for {symbol or 'ALL'}: {result_count:,} records (Tier {tier})"
            },
        }

    return {"type": 4, "data": {"content": "Unknown command"}}


# ============================================================================
# Main
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)