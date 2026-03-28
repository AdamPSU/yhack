"""Node: generate 25 NPC personas and their social relationships."""

from __future__ import annotations

import json
import random

from config import GRID_HEIGHT, GRID_WIDTH, MAX_NPCS, MAX_X, MAX_Y
from graph.llm import get_llm
from graph.prompts import GENERATE_NPCS_PROMPT
from graph.utils import parse_llm_json
from models.state import SimState

# Fallback roles & industries when the LLM call fails.
_FALLBACK_ROLES = [
    "worker", "business_owner", "politician", "student", "retiree",
    "activist", "farmer", "shopkeeper",
]
_FALLBACK_INDUSTRIES = [
    "retail", "agriculture", "tech", "healthcare", "education",
    "construction", "food service", "government",
]


def _make_fallback_npcs() -> tuple[list[dict], list[dict]]:
    """Return bare-bones 25 NPCs and a handful of relationships."""
    npcs: list[dict] = []
    for i in range(MAX_NPCS):
        npcs.append(
            {
                "id": f"npc_{i + 1:02d}",
                "name": f"Citizen {i + 1}",
                "role": _FALLBACK_ROLES[i % len(_FALLBACK_ROLES)],
                "income_level": random.choice(["low", "medium", "high"]),
                "political_leaning": round(random.uniform(-1.0, 1.0), 2),
                "industry": _FALLBACK_INDUSTRIES[i % len(_FALLBACK_INDUSTRIES)],
                "personality": "A quiet local resident.",
                "x": i % GRID_WIDTH,
                "y": i // GRID_WIDTH,
                "mood": "neutral",
            }
        )
    relationships: list[dict] = []
    for i in range(20):
        src = f"npc_{i + 1:02d}"
        tgt = f"npc_{(i + 2):02d}" if i + 2 <= MAX_NPCS else "npc_01"
        relationships.append(
            {
                "source_id": src,
                "target_id": tgt,
                "rel_type": "neighbor",
                "strength": 0.5,
            }
        )
    return npcs, relationships


def _clamp_positions(npcs: list[dict]) -> list[dict]:
    """Ensure every NPC has valid grid coordinates."""
    occupied: set[tuple[int, int]] = set()
    for npc in npcs:
        x = max(0, min(MAX_X, int(npc.get("x", 0))))
        y = max(0, min(MAX_Y, int(npc.get("y", 0))))
        # Nudge duplicates so no two NPCs share a tile.
        while (x, y) in occupied:
            x = (x + 1) % GRID_WIDTH
            if x == 0:
                y = (y + 1) % GRID_HEIGHT
        occupied.add((x, y))
        npc["x"] = x
        npc["y"] = y
    return npcs


async def generate_npcs(state: SimState) -> dict:
    """Call the LLM to create 25 NPC personas + relationships."""

    llm = get_llm(max_tokens=8192)

    entities_json = json.dumps(state["entities"], indent=2)
    prompt = GENERATE_NPCS_PROMPT.format(entities_json=entities_json)
    response = await llm.ainvoke(prompt)
    content: str = response.content  # type: ignore[assignment]

    data = parse_llm_json(content)

    npcs: list[dict] = data.get("npcs", [])
    relationships: list[dict] = data.get("relationships", [])

    # Fallback if LLM returned insufficient data.
    if len(npcs) < MAX_NPCS:
        npcs, relationships = _make_fallback_npcs()

    # Ensure exactly MAX_NPCS NPCs and valid positions.
    npcs = npcs[:MAX_NPCS]
    npcs = _clamp_positions(npcs)

    return {
        "npcs": npcs,
        "relationships": relationships,
        "current_round": 0,
    }
