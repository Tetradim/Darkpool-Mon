"""Pulse packet validation and adapter boundary."""

from __future__ import annotations


class PulsePacketRejected(ValueError):
    pass


class PulseGateway:
    allowed_packet_types = {"trade_intent"}
    forbidden_live_order_keys = {"order_id", "broker_order_id", "live_order", "place_order", "execute_order"}

    def validate_packet(self, packet: dict) -> dict:
        if packet.get("packet_type") not in self.allowed_packet_types:
            raise PulsePacketRejected("Pulse packet must be a manual execution trade_intent packet")
        if packet.get("requires_manual_execution") is not True:
            raise PulsePacketRejected("Pulse packet must require manual execution")

        present = self.forbidden_live_order_keys.intersection(packet)
        if present:
            raise PulsePacketRejected(f"Pulse packet contains forbidden live-order keys: {sorted(present)}")
        return packet
