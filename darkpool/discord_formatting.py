"""Discord payload helpers that are testable without connecting a bot."""

from __future__ import annotations

from datetime import datetime, timezone

from .command_service import CommandSummary


def summary_to_embed(summary: CommandSummary) -> dict:
    fields = []
    metric_lines = [f"{key}: {value}" for key, value in summary.metrics.items()]
    if metric_lines:
        fields.append({"name": "Metrics", "value": "\n".join(metric_lines)[:1024], "inline": False})

    for section in summary.sections:
        value = "\n".join(section.items) or "No data"
        fields.append({"name": section.title, "value": value[:1024], "inline": False})

    return {
        "title": summary.title,
        "description": summary.description[:2048],
        "color": 0x2F80ED,
        "fields": fields[:25],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": "Context only. Require confirmation and risk controls."},
    }

