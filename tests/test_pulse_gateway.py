import pytest


def test_pulse_gateway_rejects_order_like_packet():
    from darkpool.pulse_gateway import PulseGateway, PulsePacketRejected

    gateway = PulseGateway()

    with pytest.raises(PulsePacketRejected, match="manual execution"):
        gateway.validate_packet({"packet_type": "order", "requires_manual_execution": False})


def test_pulse_gateway_accepts_manual_trade_intent_packet():
    from darkpool.pulse_gateway import PulseGateway

    gateway = PulseGateway()
    packet = gateway.validate_packet({"packet_type": "trade_intent", "requires_manual_execution": True})

    assert packet["packet_type"] == "trade_intent"
    assert packet["requires_manual_execution"] is True


def test_pulse_gateway_rejects_live_order_keys():
    from darkpool.pulse_gateway import PulseGateway, PulsePacketRejected

    gateway = PulseGateway()

    with pytest.raises(PulsePacketRejected, match="forbidden live-order keys"):
        gateway.validate_packet(
            {
                "packet_type": "trade_intent",
                "requires_manual_execution": True,
                "place_order": True,
            }
        )
