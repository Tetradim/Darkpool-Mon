"""Dark pool route handlers."""

from __future__ import annotations

import os
from dataclasses import asdict
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from darkpool.alerting import build_alert_candidates
from darkpool.confluence import classify_exposure_nodes, score_confluence
from darkpool.fixtures import get_stock, sample_exposure_nodes, sample_options_flow
from darkpool.level_engine import cluster_darkpool_levels, detect_air_pockets
from darkpool.providers import ProviderError, fetch_provider_result
from darkpool.source_catalog import build_trade_confirmation_plan, list_market_information_sources
from darkpool.trade_intent import SentinelConfirmation, TradingPreferences
from darkpool.trade_pipeline import build_trade_intent_report

router = APIRouter()


class OTCAggregateResponse(BaseModel):
    """OTC Aggregate Response."""

    data: list[dict]
    provider: str
    symbol: str | None
    tier: str
    is_ats: bool
    fetched_at: str


def configured_market_providers(active_provider: str) -> list[str]:
    configured = {active_provider.lower()}
    if os.getenv("POLYGON_API_KEY"):
        configured.add("polygon")
    if os.getenv("INTRINIO_API_KEY"):
        configured.add("intrinio")
    if os.getenv("NASDAQ_HALTS_RSS_ENABLED", "").lower() in {"1", "true", "yes", "on"}:
        configured.add("nasdaq_halts")
    if os.getenv("SEC_EDGAR_USER_AGENT"):
        configured.add("sec_edgar")
    return sorted(configured)


async def _fetch_demo_otc_data(symbol: str | None) -> list[dict]:
    result = await fetch_provider_result(symbol, provider="demo", limit=500)
    return result.records


async def _fetch_finra_otc_data(symbol: str | None, tier: str, is_ats: bool) -> list[dict]:
    from finra_helper import aget_full_data

    data = await aget_full_data(symbol.upper() if symbol else None, tier, is_ats)
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


async def _fetch_polygon_otc_data(symbol: str | None) -> list[dict]:
    import httpx

    api_key = os.getenv("POLYGON_API_KEY", "")
    if not api_key:
        raise HTTPException(401, "Polygon API key not configured")

    url = f"https://api.polygon.io/v3/ticks/{symbol}/ Trades"
    params = {"timestamp": "latest", "limit": 5000}
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30.0,
        )

    if response.status_code != 200:
        return []
    data = response.json()
    return [
        {
            "symbol": trade.get("sym"),
            "price": trade.get("p"),
            "size": trade.get("s"),
            "exchange": trade.get("x"),
            "timestamp": trade.get("t"),
        }
        for trade in data.get("results", [])
    ]


async def _fetch_intrinio_otc_data(symbol: str | None) -> list[dict]:
    import httpx

    api_key = os.getenv("INTRINIO_API_KEY", "")
    if not api_key:
        raise HTTPException(401, "Intrinio API key not configured")

    url = f"https://api.intrinio.com/securities/{symbol}/ trades"
    params = {"darkpool_only": True, "page_size": 5000}
    async with httpx.AsyncClient() as client:
        response = await client.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30.0,
        )

    if response.status_code != 200:
        return []
    data = response.json()
    return [
        {
            "symbol": trade.get("ticker"),
            "price": trade.get("price"),
            "size": trade.get("volume"),
            "timestamp": trade.get("last_updated"),
        }
        for trade in data.get("trades", [])
    ]


async def _fetch_legacy_otc_data(
    symbol: str | None,
    provider: str,
    tier: str = "T1",
    is_ats: bool = True,
) -> list[dict]:
    provider_key = provider.lower()
    if provider_key == "demo":
        return await _fetch_demo_otc_data(symbol)
    if provider_key == "finra":
        return await _fetch_finra_otc_data(symbol, tier, is_ats)
    if provider_key == "polygon":
        return await _fetch_polygon_otc_data(symbol)
    if provider_key == "intrinio":
        return await _fetch_intrinio_otc_data(symbol)
    raise HTTPException(400, f"Unknown provider: {provider}")


@router.get("/darkpool/otc", response_model=OTCAggregateResponse)
async def get_otc_aggregate(
    symbol: str | None = Query(None, description="Stock symbol (e.g., AAPL)"),
    provider: str = Query("demo", description="Data provider: demo, finra, polygon, intrinio"),
    tier: Literal["T1", "T2", "OTCE"] = Query(
        "T1",
        description="T1=S&P500, T2=NMS, OTCE=OTC equities",
    ),
    is_ats: bool = Query(True, description="ATS data if true, Non-ATS otherwise"),
):
    """Get weekly OTC/dark pool aggregate data."""
    try:
        data = await _fetch_legacy_otc_data(symbol, provider, tier, is_ats)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Error fetching data: {str(exc)}")

    return OTCAggregateResponse(
        data=data,
        provider=provider,
        symbol=symbol,
        tier=tier,
        is_ats=is_ats,
        fetched_at=datetime.utcnow().isoformat(),
    )


@router.get("/darkpool/trades")
async def get_recent_trades(
    symbol: str = Query(..., description="Stock symbol"),
    provider: str = Query("demo", description="Data provider"),
    limit: int = Query(100, ge=1, le=5000, description="Max results"),
):
    """Get recent dark pool trades for a symbol."""
    try:
        data = await _fetch_legacy_otc_data(symbol, provider, "T1", True)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Error fetching trades: {str(exc)}")

    return {
        "symbol": symbol,
        "trades": data[:limit],
        "count": len(data[:limit]),
    }


@router.get("/darkpool/levels")
async def get_darkpool_levels(
    symbol: str = Query("AAPL", description="Stock symbol"),
    provider: str = Query("demo", description="Data provider: demo or finra"),
    price_bucket: float = Query(0.10, gt=0, le=5, description="Price clustering bucket"),
    limit: int = Query(25, ge=1, le=200),
):
    """Cluster dark pool prints into support/resistance context levels."""
    try:
        provider_result = await fetch_provider_result(symbol, provider=provider, limit=500)
    except ProviderError as exc:
        raise HTTPException(400, str(exc))

    levels = cluster_darkpool_levels(provider_result.prints, price_bucket=price_bucket)[:limit]
    stock = get_stock(symbol)
    spot = float(stock.get("basePrice", 100.0))
    return {
        "symbol": symbol.upper(),
        "provider": provider_result.provider,
        "degraded": provider_result.degraded,
        "message": provider_result.message,
        "spot_price": spot,
        "levels": [level.model_dump(mode="json") for level in levels],
        "air_pockets": detect_air_pockets(levels, spot),
        "fetched_at": datetime.utcnow().isoformat(),
    }


@router.get("/darkpool/confluence")
async def get_darkpool_confluence(
    symbol: str = Query("AAPL", description="Stock symbol"),
    provider: str = Query("demo", description="Data provider: demo or finra"),
    price_bucket: float = Query(0.10, gt=0, le=5),
    limit: int = Query(10, ge=1, le=50),
):
    """Score dark pool levels against Heatseeker-style exposure context and options flow."""
    try:
        provider_result = await fetch_provider_result(symbol, provider=provider, limit=500)
    except ProviderError as exc:
        raise HTTPException(400, str(exc))

    stock = get_stock(symbol)
    spot = float(stock.get("basePrice", 100.0))
    levels = cluster_darkpool_levels(provider_result.prints, price_bucket=price_bucket)
    exposure_nodes = sample_exposure_nodes(symbol, spot)
    options_flow = sample_options_flow(symbol)
    scores = score_confluence(symbol, spot, levels, exposure_nodes, options_flow)[:limit]
    node_map = classify_exposure_nodes(symbol, spot, exposure_nodes)

    return {
        "symbol": symbol.upper(),
        "provider": provider_result.provider,
        "degraded": provider_result.degraded,
        "message": provider_result.message,
        "spot_price": spot,
        "node_map": {
            key: value.model_dump(mode="json") if hasattr(value, "model_dump") else [
                item.model_dump(mode="json") for item in value
            ] if isinstance(value, list) else value
            for key, value in node_map.items()
        },
        "scores": [score.model_dump(mode="json") for score in scores],
        "fetched_at": datetime.utcnow().isoformat(),
    }


@router.get("/darkpool/alert-candidates")
async def get_darkpool_alert_candidates(
    symbol: str = Query("AAPL", description="Stock symbol"),
    provider: str = Query("demo", description="Data provider: demo or finra"),
    price_bucket: float = Query(0.10, gt=0, le=5),
    limit: int = Query(20, ge=1, le=100),
):
    """Generate explainable alert candidates without auto-execution."""
    try:
        provider_result = await fetch_provider_result(symbol, provider=provider, limit=500)
    except ProviderError as exc:
        raise HTTPException(400, str(exc))

    stock = get_stock(symbol)
    spot = float(stock.get("basePrice", 100.0))
    levels = cluster_darkpool_levels(provider_result.prints, price_bucket=price_bucket)
    scores = score_confluence(symbol, spot, levels, sample_exposure_nodes(symbol, spot), sample_options_flow(symbol))
    alerts = build_alert_candidates(symbol, levels, scores)[:limit]
    return {
        "symbol": symbol.upper(),
        "provider": provider_result.provider,
        "degraded": provider_result.degraded,
        "message": provider_result.message,
        "alerts": [alert.model_dump(mode="json") for alert in alerts],
    }


@router.get("/darkpool/information-sources")
async def get_darkpool_information_sources(
    active_provider: str = Query("demo", description="Active source provider for current workflow"),
):
    """Return market information sources and their confirmation roles."""
    configured_providers = configured_market_providers(active_provider)
    plan = build_trade_confirmation_plan(active_provider=active_provider, configured_providers=configured_providers)
    return {
        "active_provider": active_provider,
        "catalog": [source.model_dump(mode="json") for source in list_market_information_sources()],
        "confirmation_plan": plan.model_dump(mode="json"),
    }


@router.get("/darkpool/trade-intent")
async def get_darkpool_trade_intent(
    symbol: str = Query("AAPL", description="Stock symbol"),
    provider: str = Query("demo", description="Data provider: demo or finra"),
    price_bucket: float = Query(0.10, gt=0, le=5),
    min_score: float = Query(75.0, ge=0, le=100),
    max_distance_pct: float = Query(1.0, ge=0, le=10),
    min_notional: float = Query(25_000_000.0, ge=0),
    max_freshness_minutes: float = Query(120.0, ge=0),
    max_risk_dollars: float = Query(500.0, ge=0),
    stop_distance_pct: float = Query(1.0, ge=0, le=20),
    reward_risk_ratio: float = Query(2.0, ge=0),
    max_position_notional: float = Query(50_000.0, ge=0),
    max_quality_caution_flags: int = Query(99, ge=0),
    min_quality_support_flags: int = Query(0, ge=0),
    min_source_confirmation_weight: float = Query(0.0, ge=0),
    require_source_coverage_complete: bool = Query(True),
    price_confirmed: bool = Query(False),
    liquidity_confirmed: bool = Query(False),
    news_checked: bool = Query(False),
    observed_spread_bps: float = Query(0.0, ge=0),
    max_spread_bps: float = Query(25.0, ge=0),
    allow_buy: bool = Query(True),
    allow_sell: bool = Query(True),
    include_pulse_packet: bool = Query(False),
):
    """Build a user-readable trade intent and gate it through Sentinel Edge."""
    configured_providers = configured_market_providers(provider)
    preferences = TradingPreferences(
        min_score=min_score,
        max_distance_pct=max_distance_pct,
        min_notional=min_notional,
        max_freshness_minutes=max_freshness_minutes,
        max_risk_dollars=max_risk_dollars,
        stop_distance_pct=stop_distance_pct,
        reward_risk_ratio=reward_risk_ratio,
        max_position_notional=max_position_notional,
        max_quality_caution_flags=max_quality_caution_flags,
        min_quality_support_flags=min_quality_support_flags,
        min_source_confirmation_weight=min_source_confirmation_weight,
        require_complete_source_coverage=require_source_coverage_complete,
        allowed_actions=[action for action, enabled in [("BUY", allow_buy), ("SELL", allow_sell)] if enabled],
    )
    confirmation = SentinelConfirmation(
        price_confirmed=price_confirmed,
        liquidity_confirmed=liquidity_confirmed,
        news_checked=news_checked,
        observed_spread_bps=observed_spread_bps,
        max_spread_bps=max_spread_bps,
    )
    try:
        report = await build_trade_intent_report(
            symbol=symbol,
            provider=provider,
            preferences=preferences,
            confirmation=confirmation,
            include_pulse_packet=include_pulse_packet,
            price_bucket=price_bucket,
            limit=500,
            configured_providers=configured_providers,
        )
    except ProviderError as exc:
        raise HTTPException(400, str(exc))

    context = report.context
    provider_result = context.provider_result
    scores = context.scores
    confirmation_sources = context.confirmation_plan

    if not scores:
        return {
            "symbol": context.symbol,
            "provider": provider_result.provider,
            "degraded": provider_result.degraded,
            "message": provider_result.message,
            "preferences": preferences.model_dump(mode="json"),
            "confirmation_sources": confirmation_sources.model_dump(mode="json"),
            "intent": None,
            "sentinel": None,
            "pulse_packet": None,
            "pulse_status": asdict(report.pulse_status),
            "fetched_at": datetime.utcnow().isoformat(),
        }

    return {
        "symbol": context.symbol,
        "provider": provider_result.provider,
        "degraded": provider_result.degraded,
        "message": provider_result.message,
        "preferences": preferences.model_dump(mode="json"),
        "confirmation_sources": confirmation_sources.model_dump(mode="json"),
        "intent": report.intent.model_dump(mode="json") if report.intent else None,
        "sentinel": report.sentinel.model_dump(mode="json") if report.sentinel else None,
        "pulse_packet": report.pulse_packet,
        "pulse_status": asdict(report.pulse_status),
        "source_score": scores[0].model_dump(mode="json"),
        "fetched_at": datetime.utcnow().isoformat(),
    }
