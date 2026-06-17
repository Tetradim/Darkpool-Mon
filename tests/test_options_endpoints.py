from fastapi.testclient import TestClient

import server


def test_options_metric_routes_do_not_import_frontend_modules():
    client = TestClient(server.app)

    routes = [
        "/options/highest-call-vol",
        "/options/highest-put-vol",
        "/options/high-vol-cheapies",
        "/options/high-vol-leaps",
        "/options/most-otm-strikes",
        "/options/large-otm-oi",
        "/marketcap/milestones",
    ]

    for route in routes:
        response = client.get(route)
        assert response.status_code == 200, f"{route}: {response.text}"
        body = response.json()
        assert "results" in body
        assert isinstance(body["results"], list)

