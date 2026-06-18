from pathlib import Path


def test_vite_dev_server_proxies_backend_api_routes():
    config = Path("vite.config.js").read_text(encoding="utf-8")

    assert "proxy" in config
    assert "http://127.0.0.1:8002" in config
    assert '"/darkpool"' in config or "'/darkpool'" in config


def test_trade_intent_view_is_reachable_from_app_navigation():
    app = Path("src/App.jsx").read_text(encoding="utf-8")
    trade_intent_view = Path("src/TradeIntentView.jsx").read_text(encoding="utf-8")
    trade_intent_summary = Path("src/TradeIntentSummary.jsx").read_text(encoding="utf-8")

    assert "TradeIntentView" in app
    assert "import('./TradeIntentView')" in app
    assert "'intent'" in app
    assert "buildTradeIntentUrl" in trade_intent_view
    assert "Max Caution Flags" in trade_intent_view
    assert "Min Support Flags" in trade_intent_view
    assert "Min Source Weight" in trade_intent_view
    assert "Source Gate" in trade_intent_view
    assert "Source Override Reason" in trade_intent_view
    assert "formatQualityFlags" in trade_intent_summary
    assert "Signal Quality Flags" in trade_intent_summary
    assert "formatMissingSourceCoverage" in trade_intent_summary
    assert "Missing Required Source Coverage" in trade_intent_summary
    assert "formatSentinelChecks" in trade_intent_summary
    assert "Sentinel Checklist" in trade_intent_summary
    assert "formatSourceConfirmationPlan" in trade_intent_summary
    assert "Source Confirmation Plan" in trade_intent_summary
    assert "formatSourceCoverage" in trade_intent_summary
    assert "formatSourceAdjustedConfidence" in trade_intent_summary
    assert "Source-Adjusted" in trade_intent_summary
    assert "pulse_status" in trade_intent_view
    assert "pulseStatus" in trade_intent_summary


def test_trade_intent_view_is_split_into_dedicated_modules():
    assert Path("src/TradeIntentView.jsx").exists()
    assert Path("src/TradeIntentSummary.jsx").exists()
    assert Path("src/tradeIntentControls.js").exists()
