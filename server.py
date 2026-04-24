"""Darkpool Monitor Backend - Python server with FINRA API integration."""

import os
from datetime import datetime
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