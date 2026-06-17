"""Data provider wrappers for FINRA and offline demo mode."""

from __future__ import annotations

from dataclasses import dataclass

from .fixtures import get_stock, sample_darkpool_prints
from .models import DarkpoolPrint


class ProviderError(RuntimeError):
    pass


@dataclass
class ProviderResult:
    provider: str
    records: list[dict]
    prints: list[DarkpoolPrint]
    degraded: bool = False
    message: str | None = None


async def fetch_provider_result(symbol: str | None, provider: str = "demo", limit: int = 200) -> ProviderResult:
    provider = provider.lower()
    if provider == "demo":
        prints = sample_darkpool_prints(symbol, limit=limit)
        return ProviderResult(provider="demo", records=[print_.model_dump(mode="json") for print_ in prints], prints=prints)

    if provider == "finra":
        try:
            from finra_helper import aget_full_data

            raw_records = await aget_full_data(symbol.upper() if symbol else None, "T1", True)
        except Exception as exc:
            prints = sample_darkpool_prints(symbol, limit=limit)
            return ProviderResult(
                provider="demo",
                records=[print_.model_dump(mode="json") for print_ in prints],
                prints=prints,
                degraded=True,
                message=f"FINRA unavailable, using demo data: {exc}",
            )

        prints: list[DarkpoolPrint] = []
        for idx, record in enumerate(raw_records[:limit]):
            sym = record.get("issueSymbolIdentifier") or record.get("symbol") or symbol
            if not sym:
                continue
            stock = get_stock(sym)
            shares = int(record.get("totalWeeklyShareQuantity") or record.get("share_quantity") or 0)
            price = float(stock.get("basePrice", 100.0))
            timestamp = record.get("lastUpdateDate") or record.get("weekStartDate")
            from datetime import datetime, timezone

            try:
                parsed = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00")) if timestamp else datetime.now(timezone.utc)
            except ValueError:
                parsed = datetime.now(timezone.utc)
            prints.append(
                DarkpoolPrint(
                    id=f"finra-{sym}-{idx}",
                    symbol=str(sym).upper(),
                    price=price,
                    size=shares,
                    direction="NEUTRAL",
                    venue="FINRA",
                    timestamp=parsed,
                )
            )
        return ProviderResult(provider="finra", records=raw_records[:limit], prints=prints)

    raise ProviderError(f"Unsupported provider: {provider}")
