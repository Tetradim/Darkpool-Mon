"""Confluence scoring between dark pool levels, exposure nodes, and options flow."""

from __future__ import annotations

from .models import ConfluenceScore, DarkpoolLevel, ExposureNode, OptionsFlowSignal


def classify_exposure_nodes(symbol: str, spot_price: float, nodes: list[ExposureNode]) -> dict:
    relevant = [node for node in nodes if node.symbol.upper() == symbol.upper()]
    if not relevant:
        return {"king_node": None, "floor": None, "ceiling": None, "gatekeepers": [], "air_bias": "unknown"}

    king = max(relevant, key=lambda node: abs(node.exposure))
    below = [node for node in relevant if node.price < spot_price]
    above = [node for node in relevant if node.price > spot_price]
    floor = max(below, key=lambda node: abs(node.exposure), default=None)
    ceiling = max(above, key=lambda node: abs(node.exposure), default=None)
    between = []
    if king.price != spot_price:
        low, high = sorted([spot_price, king.price])
        between = [node for node in relevant if low < node.price < high and node.price != king.price]
        between.sort(key=lambda node: abs(node.exposure), reverse=True)

    return {
        "king_node": king,
        "floor": floor,
        "ceiling": ceiling,
        "gatekeepers": between[:3],
        "air_bias": "upside" if king.price > spot_price else "downside" if king.price < spot_price else "pin",
    }


def _direction_from_components(level: DarkpoolLevel, nodes: list[ExposureNode], flows: list[OptionsFlowSignal]) -> str:
    bullish = sum(1 for flow in flows if flow.direction == "BULLISH")
    bearish = sum(1 for flow in flows if flow.direction == "BEARISH")
    exposure_bias = sum(node.exposure for node in nodes)
    if level.side_bias == "BUY":
        bullish += 1
    elif level.side_bias == "SELL":
        bearish += 1
    if exposure_bias > 0:
        bullish += 1
    elif exposure_bias < 0:
        bearish += 1
    if bullish > bearish:
        return "BULLISH"
    if bearish > bullish:
        return "BEARISH"
    return "NEUTRAL"


def score_confluence(
    symbol: str,
    spot_price: float,
    levels: list[DarkpoolLevel],
    exposure_nodes: list[ExposureNode],
    options_flow: list[OptionsFlowSignal],
    proximity_pct: float = 1.0,
) -> list[ConfluenceScore]:
    scores: list[ConfluenceScore] = []
    relevant_nodes = [node for node in exposure_nodes if node.symbol.upper() == symbol.upper()]
    relevant_flows = [flow for flow in options_flow if flow.symbol.upper() == symbol.upper()]

    for level in levels:
        if level.symbol.upper() != symbol.upper():
            continue
        distance_pct = abs(level.price - spot_price) / spot_price * 100 if spot_price > 0 else 0.0
        near_nodes = [
            node
            for node in relevant_nodes
            if abs(node.price - level.price) / max(spot_price, 0.01) * 100 <= proximity_pct
        ]
        score = min(55.0, level.strength_score * 0.55)
        reasons = [f"dark pool cluster strength {level.strength_score:.1f}"]

        if distance_pct <= proximity_pct:
            score += 12
            reasons.append(f"spot is within {distance_pct:.2f}% of level")
        if near_nodes:
            node_strength = min(20.0, sum(abs(node.exposure) for node in near_nodes) / 250_000)
            score += node_strength
            reasons.append(f"{len(near_nodes)} nearby exposure node(s)")
        directional_flows = [flow for flow in relevant_flows if flow.direction in {"BULLISH", "BEARISH"}]
        if directional_flows:
            premium = sum(flow.premium for flow in directional_flows)
            score += min(13.0, premium / 350_000)
            reasons.append("options flow confirmation present")
        if level.print_count >= 3:
            score += 5
            reasons.append("multiple prints at clustered level")
        if level.freshness_minutes <= 60:
            score += 5
            reasons.append("fresh level")

        scores.append(
            ConfluenceScore(
                symbol=symbol.upper(),
                level_price=level.price,
                spot_price=spot_price,
                score=round(min(100.0, score), 2),
                direction=_direction_from_components(level, near_nodes, relevant_flows),
                distance_pct=round(distance_pct, 2),
                level=level,
                exposure_nodes=near_nodes,
                options_flow=relevant_flows,
                reasons=reasons,
            )
        )

    return sorted(scores, key=lambda item: item.score, reverse=True)
