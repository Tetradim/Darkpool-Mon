"""Typed records used by the dark pool intelligence services."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, computed_field


Direction = Literal["BUY", "SELL", "NEUTRAL"]


class StockInfo(BaseModel):
    symbol: str
    name: str
    basePrice: float
    weight: float = 1.0
    sector: str = "Technology"
    etf: str = "QQQ"


class DarkpoolPrint(BaseModel):
    id: str
    symbol: str
    price: float = Field(gt=0)
    size: int = Field(ge=0, description="Share quantity")
    direction: Direction = "NEUTRAL"
    venue: str = "ATS"
    timestamp: datetime

    @computed_field
    @property
    def notional(self) -> float:
        return round(self.price * self.size, 2)


class DarkpoolLevel(BaseModel):
    symbol: str
    price: float
    total_size: int
    notional: float
    print_count: int
    first_seen: datetime
    last_seen: datetime
    venues: list[str]
    strength_score: float
    side_bias: Direction = "NEUTRAL"
    freshness_minutes: float = 0.0


class ExposureNode(BaseModel):
    symbol: str
    price: float
    exposure: float
    kind: Literal["GEX", "VEX", "DARKPOOL"] = "GEX"
    expires_at: datetime | None = None
    updated_at: datetime


class OptionsFlowSignal(BaseModel):
    symbol: str
    direction: Literal["BULLISH", "BEARISH", "MIXED"] = "MIXED"
    premium: float = 0.0
    contracts: int = 0
    aggressor: bool = False


class MarketRegime(BaseModel):
    symbol: str
    regime: Literal["trend_up", "trend_down", "range_bound", "high_volatility", "insufficient_data"]
    trend_bias: Literal["bullish", "bearish", "neutral"]
    realized_range_pct: float
    momentum_pct: float
    vwap: float | None = None
    volume_imbalance: float
    print_count: int
    reasons: list[str] = Field(default_factory=list)


class ConfluenceScore(BaseModel):
    symbol: str
    level_price: float
    spot_price: float
    score: float
    direction: Literal["BULLISH", "BEARISH", "NEUTRAL"]
    distance_pct: float
    level: DarkpoolLevel
    exposure_nodes: list[ExposureNode]
    options_flow: list[OptionsFlowSignal]
    reasons: list[str]


class AlertCandidate(BaseModel):
    id: str
    symbol: str
    alert_type: str
    severity: Literal["info", "watch", "high", "critical"]
    message: str
    score: float
    level_price: float | None = None
    created_at: datetime
    reasons: list[str]
