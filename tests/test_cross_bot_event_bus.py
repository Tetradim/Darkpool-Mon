from fastapi.testclient import TestClient


def test_darkpool_event_store_publishes_and_filters(tmp_path, monkeypatch):
    monkeypatch.setenv("BOT_EVENT_BUS_DIR", str(tmp_path))

    from darkpool.bot_event_bus import EventBusStore, publish_event

    publish_event("darkpool.trade_intent.prepared", {"symbol": "AAPL"}, target="sentinel-edge")
    publish_event("darkpool.operator.note", {"symbol": "MSFT"}, target="darkpool-mon")

    events = EventBusStore().list_events(limit=10, target="sentinel-edge")

    assert len(events) == 1
    assert events[0]["schema_version"] == "bot-event.v1"
    assert events[0]["source"] == "darkpool-mon"
    assert events[0]["payload"] == {"symbol": "AAPL"}


def test_darkpool_bus_routes_are_registered(tmp_path, monkeypatch):
    monkeypatch.setenv("BOT_EVENT_BUS_DIR", str(tmp_path))

    import server

    client = TestClient(server.app)
    response = client.post(
        "/api/bus/events",
        json={
            "event_type": "edge.action",
            "source": "sentinel-edge",
            "target": "darkpool-mon",
            "payload": {"action": "stand_down"},
        },
    )

    assert response.status_code == 200, response.text
    event = response.json()["event"]
    assert event["target"] == "darkpool-mon"
    assert event["payload"]["action"] == "stand_down"

    response = client.get("/api/bus/events?target=darkpool-mon")
    assert response.status_code == 200, response.text
    assert response.json()["count"] == 1


def test_trade_intent_route_publishes_intel_event(tmp_path, monkeypatch):
    monkeypatch.setenv("BOT_EVENT_BUS_DIR", str(tmp_path))

    import server

    client = TestClient(server.app)
    response = client.get("/darkpool/trade-intent?symbol=AAPL&provider=demo")
    assert response.status_code == 200, response.text

    events = client.get("/api/bus/events?target=sentinel-edge").json()["events"]
    assert events
    assert events[0]["event_type"] == "darkpool.trade_intent.reviewed"
    assert events[0]["payload"]["symbol"] == "AAPL"
    assert events[0]["target"] == "sentinel-edge"
