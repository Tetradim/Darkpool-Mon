"""Alert candidate generation and deduplication."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .models import AlertCandidate, ConfluenceScore, DarkpoolLevel


def _severity(score: float) -> str:
    if score >= 90:
        return "critical"
    if score >= 75:
        return "high"
    if score >= 55:
        return "watch"
    return "info"


def build_alert_candidates(symbol: str, levels: list[DarkpoolLevel], scores: list[ConfluenceScore] | None = None) -> list[AlertCandidate]:
    now = datetime.now(timezone.utc)
    alerts: list[AlertCandidate] = []
    for level in levels:
        if level.symbol.upper() != symbol.upper() or level.strength_score < 55:
            continue
        alerts.append(
            AlertCandidate(
                id=f"{level.symbol}:level:{round(level.price, 2)}",
                symbol=level.symbol,
                alert_type="darkpool_level",
                severity=_severity(level.strength_score),
                message=f"{level.symbol} dark pool level building near ${level.price:.2f}",
                score=level.strength_score,
                level_price=level.price,
                created_at=now,
                reasons=[
                    f"{level.print_count} print(s)",
                    f"{level.total_size:,} shares",
                    f"${level.notional:,.0f} notional",
                ],
            )
        )

    for score in scores or []:
        if score.score < 60:
            continue
        alerts.append(
            AlertCandidate(
                id=f"{score.symbol}:confluence:{round(score.level_price, 2)}:{score.direction}",
                symbol=score.symbol,
                alert_type="confluence",
                severity=_severity(score.score),
                message=f"{score.symbol} {score.direction.lower()} confluence near ${score.level_price:.2f}",
                score=score.score,
                level_price=score.level_price,
                created_at=now,
                reasons=score.reasons,
            )
        )

    return sorted(alerts, key=lambda item: item.score, reverse=True)


class AlertDeduplicator:
    def __init__(self, window_seconds: int = 60):
        self.window = timedelta(seconds=window_seconds)
        self._seen: dict[str, datetime] = {}

    def allow(self, alert: AlertCandidate) -> bool:
        now = datetime.now(timezone.utc)
        last_seen = self._seen.get(alert.id)
        if last_seen and now - last_seen < self.window:
            return False
        self._seen[alert.id] = now
        self._seen = {key: value for key, value in self._seen.items() if now - value < self.window}
        return True
