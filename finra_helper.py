"""FINRA API Helper Functions.

Based on OpenBB's implementation for fetching OTC/dark pool data.
https://github.com/OpenBB-finance/OpenBB/tree/develop/openbb_platform/providers/finra
"""

import asyncio
from typing import Any


async def aget_full_data(symbol: str | None, tier: str = "T1", is_ats: bool = True):
    """Get the full data for a symbol from FINRA asynchronously."""
    import httpx

    # Establish session to avoid redirects
    session = httpx.AsyncClient(follow_redirects=True)

    try:
        # Pre-flight to establish session
        await session.get("https://www.finra.org/finra-data", timeout=10)

        # Get available weeks
        weeks_data = await aget_finra_weeks(tier, is_ats, session)
        weeks = [week["weekStartDate"] for week in weeks_data[:4]]  # Last 4 weeks

        # Fetch each week
        async def fetch_week(ws):
            result = await aget_finra_data(symbol, ws, tier, is_ats, session)
            return result if isinstance(result, list) else []

        results = await asyncio.gather(*[fetch_week(w) for w in weeks], return_exceptions=True)

        flat_results = []
        for r in results:
            if isinstance(r, list):
                flat_results.extend(r)

        return flat_results
    finally:
        await session.aclose()


async def aget_finra_weeks(tier: str = "T1", is_ats: bool = True, session: httpx.AsyncClient = None):
    """Fetch available weeks from FINRA."""
    import httpx

    request_header = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    request_data = {
        "compareFilters": [
            {
                "compareType": "EQUAL",
                "fieldName": "summaryTypeCode",
                "fieldValue": "ATS_W_SMBL" if is_ats else "OTC_W_SMBL",
            },
            {
                "compareType": "EQUAL",
                "fieldName": "tierIdentifier",
                "fieldValue": tier,
            },
        ],
        "delimiter": "|",
        "fields": ["weekStartDate"],
        "limit": 52,
        "quoteValues": False,
        "sortFields": ["-weekStartDate"],
    }

    client = session or httpx.AsyncClient(follow_redirects=True)

    try:
        response = await client.post(
            "https://api.finra.org/data/group/otcMarket/name/weeklyDownloadDetails",
            headers=request_header,
            json=request_data,
            timeout=20,
        )
        return response.json() if response.status_code == 200 else []
    finally:
        if not session:
            await client.aclose()


async def aget_finra_data(
    symbol: str | None,
    week_start: str,
    tier: str = "T1",
    is_ats: bool = True,
    session: httpx.AsyncClient = None,
) -> list[dict[str, Any]]:
    """Get FINRA data for a specific week."""
    import httpx

    filters = [
        {"compareType": "EQUAL", "fieldName": "weekStartDate", "fieldValue": week_start},
        {"compareType": "EQUAL", "fieldName": "tierIdentifier", "fieldValue": tier},
        {
            "compareType": "EQUAL",
            "description": "",
            "fieldName": "summaryTypeCode",
            "fieldValue": "ATS_W_SMBL" if is_ats else "OTC_W_SMBL",
        },
    ]

    if symbol:
        filters.append(
            {"compareType": "EQUAL", "fieldName": "issueSymbolIdentifier", "fieldValue": symbol}
        )

    request_data = {
        "compareFilters": filters,
        "delimiter": "|",
        "fields": [
            "issueSymbolIdentifier",
            "totalWeeklyShareQuantity",
            "totalWeeklyTradeCount",
            "lastUpdateDate",
        ],
        "limit": 5000,
        "quoteValues": False,
        "sortFields": ["totalWeeklyShareQuantity"],
    }

    req_hdr = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    client = session or httpx.AsyncClient(follow_redirects=True)

    try:
        response = await client.post(
            "https://api.finra.org/data/group/otcMarket/name/weeklySummary",
            headers=req_hdr,
            json=request_data,
            timeout=20,
        )
        return response.json() if response.status_code == 200 else []
    finally:
        if not session:
            await client.aclose()


# =============================================================================
# Simple sync versions for simpler use cases
# =============================================================================

def get_available_weeks(tier: str = "T1", is_ats: bool = True) -> list[dict]:
    """Get available weeks (sync version)."""
    import requests

    request_header = {"Accept": "application/json", "Content-Type": "application/json"}

    request_data = {
        "compareFilters": [
            {
                "compareType": "EQUAL",
                "fieldName": "summaryTypeCode",
                "fieldValue": "ATS_W_SMBL" if is_ats else "OTC_W_SMBL",
            },
            {
                "compareType": "EQUAL",
                "fieldName": "tierIdentifier",
                "fieldValue": tier,
            },
        ],
        "delimiter": "|",
        "fields": ["weekStartDate"],
        "limit": 52,
        "quoteValues": False,
        "sortFields": ["-weekStartDate"],
    }

    response = requests.post(
        "https://api.finra.org/data/group/otcMarket/name/weeklyDownloadDetails",
        headers=request_header,
        json=request_data,
        timeout=20,
    )

    return response.json() if response.status_code == 200 else []


def get_otc_data(symbol: str | None, week_start: str, tier: str = "T1", is_ats: bool = True) -> list[dict]:
    """Get OTC data for a specific week (sync version)."""
    import requests

    filters = [
        {"compareType": "EQUAL", "fieldName": "weekStartDate", "fieldValue": week_start},
        {"compareType": "EQUAL", "fieldName": "tierIdentifier", "fieldValue": tier},
        {
            "compareType": "EQUAL",
            "fieldName": "summaryTypeCode",
            "fieldValue": "ATS_W_SMBL" if is_ats else "OTC_W_SMBL",
        },
    ]

    if symbol:
        filters.append(
            {"compareType": "EQUAL", "fieldName": "issueSymbolIdentifier", "fieldValue": symbol}
        )

    request_data = {
        "compareFilters": filters,
        "delimiter": "|",
        "fields": [
            "issueSymbolIdentifier",
            "totalWeeklyShareQuantity",
            "totalWeeklyTradeCount",
            "lastUpdateDate",
        ],
        "limit": 5000,
        "quoteValues": False,
        "sortFields": ["totalWeeklyShareQuantity"],
    }

    req_hdr = {"Accept": "application/json", "Content-Type": "application/json"}

    response = requests.post(
        "https://api.finra.org/data/group/otcMarket/name/weeklySummary",
        headers=req_hdr,
        json=request_data,
        timeout=20,
    )

    return response.json() if response.status_code == 200 else []


if __name__ == "__main__":
    # Quick test
    import json

    weeks = get_available_weeks("T1", True)
    print(f"Available weeks: {len(weeks)}")

    if weeks:
        latest_week = weeks[0]["weekStartDate"]
        print(f"Latest week: {latest_week}")

        # Test AAPL
        data = get_otc_data("AAPL", latest_week, "T1", True)
        print(f"AAPL data: {len(data)} records")
        print(json.dumps(data[:2], indent=2))