"""Market information source catalog for trade confirmation planning."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SourceRole = Literal[
    "darkpool_context",
    "price_confirmation",
    "liquidity_confirmation",
    "options_confirmation",
    "risk_blocker",
    "news_context",
]
SourceCadence = Literal["real_time", "delayed", "historical", "on_demand"]
SourcePriority = Literal["required", "strong", "context"]
SourceStatus = Literal["available", "configured", "missing"]


class MarketInformationSource(BaseModel):
    id: str
    name: str
    provider: str
    role: SourceRole
    cadence: SourceCadence
    priority: SourcePriority
    confirmation_weight: float = Field(ge=0, le=1)
    status: SourceStatus = "missing"
    official_url: str
    confirms: list[str]
    limitations: list[str]
    current_integration: str


class TradeConfirmationPlan(BaseModel):
    sources: list[MarketInformationSource]
    available_confirmation_weight: float
    missing_confirmation_weight: float
    recommended_next_sources: list[str]
    summary: str


def list_market_information_sources() -> list[MarketInformationSource]:
    return [
        MarketInformationSource(
            id="finra_otc_transparency",
            name="FINRA OTC Transparency",
            provider="FINRA",
            role="darkpool_context",
            cadence="delayed",
            priority="context",
            confirmation_weight=0.0,
            official_url="https://www.finra.org/filing-reporting/otc-transparency",
            confirms=["ATS and non-ATS weekly aggregate activity", "historical darkpool participation context"],
            limitations=["not a real-time execution confirmation source"],
            current_integration="implemented for weekly aggregate/demo-compatible context",
        ),
        MarketInformationSource(
            id="finra_reg_sho",
            name="FINRA Reg SHO Daily Short Sale Volume",
            provider="FINRA",
            role="liquidity_confirmation",
            cadence="delayed",
            priority="context",
            confirmation_weight=0.05,
            official_url="https://developer.finra.org/docs/api-explorer/query_api-equity-reg_sho_daily_short_sale_volume",
            confirms=["daily short-sale pressure context", "sell-side volume participation"],
            limitations=["daily aggregate, not intraday confirmation"],
            current_integration="planned",
        ),
        MarketInformationSource(
            id="sip_nbbo",
            name="SIP/NBBO feed",
            provider="CTA/UTP or licensed market data vendor",
            role="price_confirmation",
            cadence="real_time",
            priority="required",
            confirmation_weight=0.35,
            official_url="https://www.nyse.com/market-data/historical/daily-taq",
            confirms=["last sale", "NBBO spread", "price acceptance near level"],
            limitations=["requires licensed real-time or historical market data access"],
            current_integration="missing adapter",
        ),
        MarketInformationSource(
            id="nasdaq_totalview",
            name="Nasdaq TotalView-ITCH",
            provider="Nasdaq",
            role="liquidity_confirmation",
            cadence="real_time",
            priority="strong",
            confirmation_weight=0.2,
            official_url="https://data.nasdaq.com/databases/NTV",
            confirms=["order book depth", "displayed liquidity", "imbalance around level"],
            limitations=["venue-specific direct feed; does not cover every market center alone"],
            current_integration="missing adapter",
        ),
        MarketInformationSource(
            id="opra_options",
            name="OPRA/Cboe LiveVol options data",
            provider="OPRA or Cboe LiveVol",
            role="options_confirmation",
            cadence="real_time",
            priority="strong",
            confirmation_weight=0.25,
            official_url="https://api.livevol.com/",
            confirms=["options trades", "options quotes", "implied volatility and flow alignment"],
            limitations=["requires licensed options data and normalization"],
            current_integration="demo fixtures only",
        ),
        MarketInformationSource(
            id="trading_halts",
            name="Nasdaq/NYSE trading halts",
            provider="Nasdaq Trader and NYSE",
            role="risk_blocker",
            cadence="real_time",
            priority="required",
            confirmation_weight=0.2,
            official_url="https://www.nasdaqtrader.com/trader.aspx?id=tradehalts",
            confirms=["current halt state", "LULD/news-pending risk", "trade eligibility"],
            limitations=["requires polling or feed adapter for timely gating"],
            current_integration="missing adapter",
        ),
        MarketInformationSource(
            id="news_events",
            name="Material news and events",
            provider="Exchange halt feeds, SEC EDGAR, licensed news vendor",
            role="news_context",
            cadence="real_time",
            priority="required",
            confirmation_weight=0.15,
            official_url="https://www.sec.gov/edgar/search/",
            confirms=["material filings", "news-pending risk", "event context"],
            limitations=["needs vendor-specific relevance scoring before automated gating"],
            current_integration="manual Sentinel checkbox only",
        ),
    ]


def build_trade_confirmation_plan(
    active_provider: str = "demo",
    configured_providers: list[str] | None = None,
) -> TradeConfirmationPlan:
    configured = {provider.lower() for provider in (configured_providers or [])}
    configured.add(active_provider.lower())
    sources: list[MarketInformationSource] = []
    for source in list_market_information_sources():
        status: SourceStatus = "missing"
        if source.id == "finra_otc_transparency" and "finra" in configured:
            status = "available"
        elif source.id in {"sip_nbbo", "nasdaq_totalview"} and "polygon" in configured:
            status = "configured"
        elif source.id == "opra_options" and ("livevol" in configured or "intrinio" in configured):
            status = "configured"
        sources.append(source.model_copy(update={"status": status}))

    confirmation_sources = [source for source in sources if source.confirmation_weight > 0]
    available_weight = round(
        sum(source.confirmation_weight for source in confirmation_sources if source.status in {"available", "configured"}),
        2,
    )
    missing_weight = round(
        sum(source.confirmation_weight for source in confirmation_sources if source.status == "missing"),
        2,
    )
    recommendations = _build_recommendations(sources)
    context_available = any(
        source.role == "darkpool_context" and source.status in {"available", "configured"} for source in sources
    )
    summary = (
        f"{'context source available' if context_available else 'no darkpool context source available'}; "
        f"{available_weight:.2f} confirmation weight configured, {missing_weight:.2f} missing."
    )
    return TradeConfirmationPlan(
        sources=sources,
        available_confirmation_weight=available_weight,
        missing_confirmation_weight=missing_weight,
        recommended_next_sources=recommendations,
        summary=summary,
    )


def _build_recommendations(sources: list[MarketInformationSource]) -> list[str]:
    missing = {source.id for source in sources if source.status == "missing"}
    recommendations: list[str] = []
    if "sip_nbbo" in missing:
        recommendations.append("Add real-time price/NBBO feed for spread and price confirmation.")
    if "trading_halts" in missing:
        recommendations.append("Add trading halt/LULD feed before treating Sentinel approval as execution-ready.")
    if "opra_options" in missing:
        recommendations.append("Add OPRA or Cboe LiveVol options data for options-flow confirmation.")
    if "nasdaq_totalview" in missing:
        recommendations.append("Add depth-of-book feed for liquidity confirmation around darkpool levels.")
    return recommendations
