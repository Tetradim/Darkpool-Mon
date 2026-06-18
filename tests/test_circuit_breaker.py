from datetime import datetime, timedelta

from server import CircuitBreaker, CircuitState


def test_open_circuit_uses_configured_timeout_as_initial_backoff():
    circuit = CircuitBreaker("test-provider", failure_threshold=1, timeout=30, max_backoff=120)

    circuit.record_failure()

    assert circuit.state == CircuitState.OPEN
    assert circuit.backoff_seconds == 30
    assert circuit.get_status()["next_retry_seconds"] == 30


def test_blocked_can_execute_checks_do_not_extend_backoff_window():
    circuit = CircuitBreaker("test-provider", failure_threshold=1, timeout=30, max_backoff=120)
    circuit.record_failure()

    assert circuit.can_execute() is False
    assert circuit.can_execute() is False
    assert circuit.can_execute() is False

    assert circuit.backoff_seconds == 30


def test_open_circuit_transitions_to_half_open_after_backoff_elapsed():
    circuit = CircuitBreaker("test-provider", failure_threshold=1, timeout=30, max_backoff=120)
    circuit.record_failure()
    circuit.last_failure = datetime.utcnow() - timedelta(seconds=31)

    assert circuit.can_execute() is True
    assert circuit.state == CircuitState.HALF_OPEN
