"""Shared summary builders for API and Discord commands."""

from __future__ import annotations

from dataclasses import dataclass, field

from .alerting import build_alert_candidates
from .confluence import score_confluence
from .fixtures import get_stock, sample_darkpool_prints, sample_exposure_nodes, sample_options_flow
from .level_engine import cluster_darkpool_levels


@dataclass
class SummarySection:
    title: str
    items: list[str]


@dataclass
class CommandSummary:
    command: str
    symbol: str
    title: str
    description: str
    metrics: dict[str, str] = field(default_factory=dict)
    sections: list[SummarySection] = field(default_factory=list)


def _data_context(symbol: str, provider: str = "demo"):
    sym = symbol.upper()
    stock = get_stock(sym)
    spot = float(stock.get("basePrice", 100.0))
    prints = sample_darkpool_prints(sym, limit=220)
    levels = cluster_darkpool_levels(prints)[:8]
    exposure = sample_exposure_nodes(sym, spot)
    flow = sample_options_flow(sym)
    scores = score_confluence(sym, spot, levels, exposure, flow)[:8]
    alerts = build_alert_candidates(sym, levels, scores)[:8]
    return sym, spot, prints, levels, scores, alerts


def build_levels_summary(symbol: str, provider: str = "demo", limit: int = 5) -> CommandSummary:
    sym, spot, prints, levels, _, _ = _data_context(symbol, provider)
    items = [
        f"${level.price:.2f} | score {level.strength_score:.1f} | {level.total_size:,} sh | {level.print_count} print(s)"
        for level in levels[:limit]
    ]
    return CommandSummary(
        command="levels",
        symbol=sym,
        title=f"{sym} Dark Pool Levels",
        description="Clustered dark pool context levels. Not trade entries.",
        metrics={"provider": provider, "spot": f"{spot:.2f}", "prints": f"{len(prints)}"},
        sections=[SummarySection("Top Levels", items or ["No levels found"])],
    )


def build_confluence_summary(symbol: str, provider: str = "demo", limit: int = 5) -> CommandSummary:
    sym, spot, _, _, scores, _ = _data_context(symbol, provider)
    items = [
        f"${score.level_price:.2f} | {score.direction} | score {score.score:.1f} | {', '.join(score.reasons[:2])}"
        for score in scores[:limit]
    ]
    return CommandSummary(
        command="confluence",
        symbol=sym,
        title=f"{sym} Confluence",
        description="Dark pool levels scored against exposure nodes and options-flow context.",
        metrics={"provider": provider, "spot": f"{spot:.2f}"},
        sections=[SummarySection("Highest Scores", items or ["No confluence scores found"])],
    )


def build_alerts_summary(symbol: str, provider: str = "demo", limit: int = 5) -> CommandSummary:
    sym, spot, _, _, _, alerts = _data_context(symbol, provider)
    items = [
        f"{alert.severity.upper()} | {alert.message} | score {alert.score:.1f}"
        for alert in alerts[:limit]
    ]
    return CommandSummary(
        command="alerts",
        symbol=sym,
        title=f"{sym} Alert Candidates",
        description="Explainable candidates for human review and optional autoposting.",
        metrics={"provider": provider, "spot": f"{spot:.2f}"},
        sections=[SummarySection("Candidates", items or ["No alert candidates found"])],
    )


def build_darkpool_summary(symbol: str, provider: str = "demo") -> CommandSummary:
    levels = build_levels_summary(symbol, provider, limit=3)
    confluence = build_confluence_summary(symbol, provider, limit=3)
    alerts = build_alerts_summary(symbol, provider, limit=3)
    return CommandSummary(
        command="darkpool",
        symbol=levels.symbol,
        title=f"{levels.symbol} Darkpool Monitor",
        description="Level, confluence, and alert context. Require price confirmation before acting.",
        metrics=levels.metrics,
        sections=[
            levels.sections[0],
            confluence.sections[0],
            alerts.sections[0],
        ],
    )


def build_watchlist_summary(symbols: list[str], provider: str = "demo") -> CommandSummary:
    cleaned = [symbol.strip().upper() for symbol in symbols if symbol.strip()]
    rows: list[tuple[str, float, str]] = []
    for symbol in cleaned:
        summary = build_alerts_summary(symbol, provider, limit=1)
        first = summary.sections[0].items[0]
        score = 0.0
        if "score " in first:
            try:
                score = float(first.rsplit("score ", 1)[1])
            except ValueError:
                score = 0.0
        rows.append((symbol, score, first))
    rows.sort(key=lambda item: item[1], reverse=True)

    return CommandSummary(
        command="watchlist",
        symbol=",".join(cleaned),
        title="Watchlist Darkpool Summary",
        description="Top alert candidate per ticker.",
        metrics={"provider": provider, "symbols": ",".join(cleaned)},
        sections=[SummarySection("Watchlist", [f"{symbol}: {text}" for symbol, _, text in rows])],
    )

