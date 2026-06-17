import pytest
from fastapi.testclient import TestClient

import server


def test_discord_signature_verifier_allows_unsigned_local_mode():
    from darkpool.discord_security import DiscordSignatureVerifier

    verifier = DiscordSignatureVerifier(public_key="", allow_unsigned=True)

    assert verifier.verify(timestamp="1", body=b"{}", signature="") is True


def test_discord_signature_verifier_rejects_unsigned_payload_when_required():
    from darkpool.discord_security import DiscordSignatureVerifier, SignatureVerificationError

    verifier = DiscordSignatureVerifier(public_key="", allow_unsigned=False)

    with pytest.raises(SignatureVerificationError, match="required"):
        verifier.verify(timestamp="1", body=b"{}", signature="")


def test_discord_command_route_rejects_unsigned_payload_when_required(monkeypatch):
    monkeypatch.setenv("ALLOW_UNSIGNED_DISCORD_INTERACTIONS", "false")
    monkeypatch.setenv("DISCORD_PUBLIC_KEY", "")
    client = TestClient(server.app)

    response = client.post(
        "/discord/commands",
        json={"id": "1", "type": 2, "data": {"name": "unknown"}, "member": None, "guild_id": None, "channel_id": None},
    )

    assert response.status_code == 401


def test_discord_command_route_allows_unsigned_payload_in_local_mode(monkeypatch):
    monkeypatch.setenv("ALLOW_UNSIGNED_DISCORD_INTERACTIONS", "true")
    monkeypatch.setenv("DISCORD_PUBLIC_KEY", "")
    client = TestClient(server.app)

    response = client.post(
        "/discord/commands",
        json={"id": "1", "type": 2, "data": {"name": "unknown"}, "member": None, "guild_id": None, "channel_id": None},
    )

    assert response.status_code == 200
    assert response.json()["data"]["content"] == "Unknown command"
