from pathlib import Path


def test_vite_dev_server_proxies_backend_api_routes():
    config = Path("vite.config.js").read_text(encoding="utf-8")

    assert "proxy" in config
    assert "http://127.0.0.1:8000" in config
    assert '"/darkpool"' in config or "'/darkpool'" in config


def test_trade_intent_view_is_reachable_from_app_navigation():
    app = Path("src/App.jsx").read_text(encoding="utf-8")
    production_views = Path("src/ProductionViews.jsx").read_text(encoding="utf-8")

    assert "TradeIntentView" in app
    assert "'intent'" in app
    assert "TradeIntentView" in production_views
    assert "/darkpool/trade-intent" in production_views
    assert "formatQualityFlags" in production_views
    assert "Signal Quality Flags" in production_views
    assert "Max Caution Flags" in production_views
    assert "Min Support Flags" in production_views
    assert "formatSentinelChecks" in production_views
    assert "Sentinel Checklist" in production_views
    assert "formatSourceConfirmationPlan" in production_views
    assert "Source Confirmation Plan" in production_views
