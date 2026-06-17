from darkpool.source_catalog import build_trade_confirmation_plan, list_market_information_sources


def test_source_catalog_marks_finra_as_context_and_live_feeds_as_confirmation():
    sources = list_market_information_sources()
    by_id = {source.id: source for source in sources}

    assert by_id["finra_otc_transparency"].role == "darkpool_context"
    assert by_id["finra_otc_transparency"].cadence == "delayed"
    assert "not a real-time execution confirmation" in by_id["finra_otc_transparency"].limitations[0]
    assert by_id["sip_nbbo"].role == "price_confirmation"
    assert by_id["sip_nbbo"].priority == "required"
    assert by_id["opra_options"].role == "options_confirmation"
    assert by_id["trading_halts"].role == "risk_blocker"


def test_trade_confirmation_plan_separates_available_context_from_missing_confirmation_sources():
    plan = build_trade_confirmation_plan(active_provider="finra", configured_providers=["finra"])
    by_id = {source.id: source for source in plan.sources}

    assert by_id["finra_otc_transparency"].status == "available"
    assert by_id["sip_nbbo"].status == "missing"
    assert by_id["opra_options"].status == "missing"
    assert by_id["trading_halts"].status == "missing"
    assert plan.available_confirmation_weight == 0
    assert "real-time price/NBBO" in plan.recommended_next_sources[0]
    assert "context source available" in plan.summary


def test_information_sources_endpoint_does_not_mark_finra_available_for_demo_workflow():
    from fastapi.testclient import TestClient

    import server

    client = TestClient(server.app)
    response = client.get("/darkpool/information-sources?active_provider=demo")

    assert response.status_code == 200, response.text
    plan = response.json()["confirmation_plan"]
    by_id = {source["id"]: source for source in plan["sources"]}
    assert by_id["finra_otc_transparency"]["status"] == "missing"
    assert "no darkpool context source available" in plan["summary"]


def test_information_sources_endpoint_marks_finra_available_for_finra_workflow():
    from fastapi.testclient import TestClient

    import server

    client = TestClient(server.app)
    response = client.get("/darkpool/information-sources?active_provider=finra")

    assert response.status_code == 200, response.text
    plan = response.json()["confirmation_plan"]
    by_id = {source["id"]: source for source in plan["sources"]}
    assert by_id["finra_otc_transparency"]["status"] == "available"
    assert "context source available" in plan["summary"]
