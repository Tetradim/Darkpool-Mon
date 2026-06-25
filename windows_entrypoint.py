"""Windows packaged entrypoint for Darkpool Monitor."""

import os

import uvicorn

import server


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8002"))
    host = os.getenv("DARKPOOL_HOST", "127.0.0.1")
    uvicorn.run(server.app, host=host, port=port)
