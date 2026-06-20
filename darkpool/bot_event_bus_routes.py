"""FastAPI routes for Darkpool Monitor Cross Bot Event Bus access."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from .bot_event_bus import EventBusStore, publish_event


router = APIRouter(prefix="/api/bus", tags=["cross-bot-event-bus"])


class EventRequest(BaseModel):
    event_type: str = Field(..., min_length=1)
    payload: dict[str, Any] = Field(default_factory=dict)
    source: str = "darkpool-mon"
    target: str | None = None


@router.get("/events")
async def list_events(
    limit: int = Query(100, ge=1, le=1000),
    target: str | None = Query(None),
) -> dict[str, Any]:
    events = EventBusStore().list_events(limit=limit, target=target)
    return {"events": events, "count": len(events)}


@router.post("/events")
async def create_event(request: EventRequest) -> dict[str, Any]:
    event = publish_event(
        request.event_type,
        request.payload,
        source=request.source,
        target=request.target,
    )
    return {"event": event}
