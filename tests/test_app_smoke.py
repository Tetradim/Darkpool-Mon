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
