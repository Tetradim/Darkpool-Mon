from pathlib import Path

from fastapi.testclient import TestClient

import server


def test_core_smoke_routes_are_healthy():
    client = TestClient(server.app)

    for path in ["/", "/health", "/providers", "/health/circuit"]:
        response = client.get(path)
        assert response.status_code == 200, response.text


def test_darkpool_demo_routes_return_structured_payloads():
    client = TestClient(server.app)

    response = client.get("/darkpool/levels?symbol=AAPL&provider=demo")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["symbol"] == "AAPL"
    assert isinstance(body["levels"], list)

    response = client.get("/darkpool/confluence?symbol=AAPL&provider=demo")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["symbol"] == "AAPL"
    assert isinstance(body["scores"], list)


def test_darkpool_router_routes_remain_registered():
    client = TestClient(server.app)

    response = client.get("/darkpool/trade-intent?symbol=AAPL&provider=demo")

    assert response.status_code == 200, response.text
    assert response.json()["symbol"] == "AAPL"


def test_visualization_routes_work_without_external_provider_keys():
    client = TestClient(server.app)

    for path in [
        "/visualization/area?symbol=AAPL",
        "/visualization/bar",
        "/visualization/combined?symbol=AAPL",
        "/grafana/table?symbol=AAPL",
        "/grafana/timeseries?symbol=AAPL",
    ]:
        response = client.get(path)
        assert response.status_code == 200, f"{path}: {response.text}"


def test_documented_python_server_startup_registers_all_routes_before_running_uvicorn():
    source = Path("server.py").read_text(encoding="utf-8")

    main_block = source.index('if __name__ == "__main__":')
    last_route_decorator = max(source.rfind("@app."), source.rfind("@app.websocket"))

    assert last_route_decorator < main_block


def test_server_startup_uses_lifespan_hook_instead_of_deprecated_event():
    source = Path("server.py").read_text(encoding="utf-8")

    assert 'lifespan=lifespan' in source
    assert '@app.on_event("startup")' not in source


def test_alert_route_records_successful_delivery_history():
    client = TestClient(server.app)
    server.alert_router.recent_alerts.clear()
    server.alert_router.routing_history.clear()

    response = client.post("/alerts/route?symbol=AAPL&alert_type=smoke&channel=discord&size=1")

    assert response.status_code == 200, response.text
    assert response.json() == {"status": "sent"}
    assert server.alert_router.routing_history
    assert server.alert_router.routing_history[-1]["channel"] == "discord"
    assert server.alert_router.routing_history[-1]["success"] is True
    assert server.alert_router.routing_history[-1]["timestamp"]


def test_admin_audit_log_returns_unique_row_ids_for_react_keys():
    client = TestClient(server.app)

    response = client.get("/admin/audit-log?limit=250")

    assert response.status_code == 200, response.text
    ids = [row["id"] for row in response.json()["logs"]]
    assert len(ids) == len(set(ids))
