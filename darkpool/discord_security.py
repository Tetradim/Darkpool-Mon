"""Discord interaction signature verification."""

from __future__ import annotations


class SignatureVerificationError(ValueError):
    pass


class DiscordSignatureVerifier:
    def __init__(self, public_key: str, allow_unsigned: bool = False):
        self.public_key = public_key.strip()
        self.allow_unsigned = allow_unsigned

    def verify(self, timestamp: str, body: bytes, signature: str) -> bool:
        if self.allow_unsigned:
            return True
        if not self.public_key or not timestamp or not signature:
            raise SignatureVerificationError("Discord signature verification is required")

        from nacl.exceptions import BadSignatureError
        from nacl.signing import VerifyKey

        try:
            verify_key = VerifyKey(bytes.fromhex(self.public_key))
            verify_key.verify(timestamp.encode("utf-8") + body, bytes.fromhex(signature))
        except (BadSignatureError, ValueError) as exc:
            raise SignatureVerificationError("Invalid Discord interaction signature") from exc
        return True
