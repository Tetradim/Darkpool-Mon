import os
import socket
import subprocess
import sys
import time

import httpx
from fastapi.testclient import TestClient

import server


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def test_create_app_returns_registered_fastapi_app():
    app = server.create_app()
    client = TestClient(app)

    assert client.get("/health").status_code == 200
    assert client.get("/darkpool/trade-intent?symbol=AAPL&provider=demo").status_code == 200
    assert client.post(
        "/alerts/route?symbol=AAPL&alert_type=factory&channel=discord&size=1"
    ).status_code == 200


def test_python_server_registers_late_routes_at_runtime():
    port = _free_port()
    env = os.environ.copy()
    env["PORT"] = str(port)
    process = subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=os.getcwd(),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        response = None
        last_error = None
        deadline = time.time() + 15
        while time.time() < deadline:
            try:
                response = httpx.post(
                    f"http://127.0.0.1:{port}/alerts/route",
                    params={"symbol": "AAPL", "alert_type": "runtime", "channel": "discord", "size": 1},
                    timeout=1,
                )
                if response.status_code == 200:
                    break
            except Exception as exc:
                last_error = exc
                time.sleep(0.25)
        else:
            raise AssertionError(f"server did not expose /alerts/route: {last_error}")

        assert response is not None
        assert response.json() == {"status": "sent"}
    finally:
        process.terminate()
        process.wait(timeout=10)
