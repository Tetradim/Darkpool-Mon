from datetime import datetime, timedelta, timezone

from darkpool.level_engine import cluster_darkpool_levels
from darkpool.models import DarkpoolPrint


def make_print(symbol: str, price: float, shares: int, minutes_ago: int = 0) -> DarkpoolPrint:
    return DarkpoolPrint(
        id=f"{symbol}-{price}-{shares}-{minutes_ago}",
        symbol=symbol,
        price=price,
        size=shares,
        direction="BUY",
        venue="DARK",
        timestamp=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
    )


def test_cluster_darkpool_levels_groups_nearby_prints_and_scores_strength():
    prints = [
        make_print("AAPL", 190.01, 200_000, 5),
        make_print("AAPL", 190.03, 150_000, 10),
        make_print("AAPL", 194.00, 25_000, 80),
    ]

    levels = cluster_darkpool_levels(prints, price_bucket=0.05)

    assert len(levels) == 2
    assert levels[0].symbol == "AAPL"
    assert levels[0].print_count == 2
    assert levels[0].total_size == 350_000
    assert levels[0].notional > levels[1].notional
    assert levels[0].strength_score > levels[1].strength_score

