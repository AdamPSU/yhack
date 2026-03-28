"""Node: generate 25 NPC personas and their social relationships."""

from __future__ import annotations

import json
import logging
import random
from typing import Any

from config import GRID_HEIGHT, GRID_WIDTH, MAX_NPCS, MAX_X, MAX_Y
from graph.llm import invoke_llm_structured
from graph.prompts import GENERATE_NPCS_PROMPT
from graph.utils import clamp
from models.schemas import NPC, NPCGenerationResponse, Relationship
from models.state import SimState

logger = logging.getLogger(__name__)

# Fallback roles & industries when the LLM call fails.
_FALLBACK_ROLES: list[str] = [
    "worker", "business_owner", "politician", "student", "retiree",
    "activist", "farmer", "shopkeeper",
]
_FALLBACK_INDUSTRIES = [
    "retail", "agriculture", "tech", "healthcare", "education",
    "construction", "food service", "government",
]


def _make_fallback_npcs() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return bare-bones 25 NPCs and a handful of relationships."""
    npcs: list[dict[str, Any]] = []
    for i in range(MAX_NPCS):
        npc = NPC(
            id=f"npc_{i + 1:02d}",
            name=f"Citizen {i + 1}",
            role=_FALLBACK_ROLES[i % len(_FALLBACK_ROLES)],  # pyright: ignore[reportArgumentType]
            income_level=random.choice(["low", "medium", "high"]),
            political_leaning=round(random.uniform(-1.0, 1.0), 2),
            industry=_FALLBACK_INDUSTRIES[i % len(_FALLBACK_INDUSTRIES)],
            personality="A quiet local resident.",
            x=i % GRID_WIDTH,
            y=i // GRID_WIDTH,
        )
        npcs.append(npc.model_dump())
    # Build a diverse relationship graph: family clusters, workplace ties,
    # friendships, and neighbor links so opinion dynamics has real connections.
    relationships: list[dict[str, Any]] = []

    # Family clusters: groups of 2-3.
    family_pairs = [(1, 2), (3, 4), (5, 6), (7, 8, 9), (10, 11), (22, 23, 24)]
    for group in family_pairs:
        for j in range(len(group)):
            for k in range(j + 1, len(group)):
                relationships.append(Relationship(
                    source_id=f"npc_{group[j]:02d}",
                    target_id=f"npc_{group[k]:02d}",
                    rel_type="family",
                    strength=round(random.uniform(0.7, 1.0), 2),
                ).model_dump())

    # Colleague/employer ties (same industry neighbors in the role list).
    colleague_pairs = [(2, 14), (6, 18), (12, 20), (4, 16), (1, 9)]
    for src, tgt in colleague_pairs:
        relationships.append(Relationship(
            source_id=f"npc_{src:02d}",
            target_id=f"npc_{tgt:02d}",
            rel_type="colleague",
            strength=round(random.uniform(0.3, 0.7), 2),
        ).model_dump())

    # Employer relationships.
    employer_pairs = [(2, 1), (10, 17), (18, 25)]
    for boss, worker in employer_pairs:
        relationships.append(Relationship(
            source_id=f"npc_{boss:02d}",
            target_id=f"npc_{worker:02d}",
            rel_type="employer",
            strength=round(random.uniform(0.5, 0.8), 2),
        ).model_dump())

    # Friendships across the town.
    friend_pairs = [
        (1, 5), (3, 12), (7, 15), (4, 21), (8, 19),
        (11, 25), (13, 20), (6, 14), (16, 24), (9, 17),
    ]
    for src, tgt in friend_pairs:
        relationships.append(Relationship(
            source_id=f"npc_{src:02d}",
            target_id=f"npc_{tgt:02d}",
            rel_type="friend",
            strength=round(random.uniform(0.4, 0.9), 2),
        ).model_dump())

    # Neighbor links for spatially adjacent NPCs.
    for i in range(1, MAX_NPCS):
        relationships.append(Relationship(
            source_id=f"npc_{i:02d}",
            target_id=f"npc_{i + 1:02d}",
            rel_type="neighbor",
            strength=round(random.uniform(0.2, 0.6), 2),
        ).model_dump())

    return npcs, relationships


def _clamp_positions(npcs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ensure every NPC has valid grid coordinates."""
    occupied: set[tuple[int, int]] = set()
    for npc in npcs:
        x = int(clamp(int(npc.get("x", 0)), 0, MAX_X))
        y = int(clamp(int(npc.get("y", 0)), 0, MAX_Y))
        # Nudge duplicates so no two NPCs share a tile.
        while (x, y) in occupied:
            x = (x + 1) % GRID_WIDTH
            if x == 0:
                y = (y + 1) % GRID_HEIGHT
        occupied.add((x, y))
        npc["x"] = x
        npc["y"] = y
    return npcs


async def generate_npcs(state: SimState) -> dict[str, Any]:
    """Call the LLM to create 25 NPC personas + relationships."""

    entities_json = json.dumps(state["entities"], indent=2)
    prompt = GENERATE_NPCS_PROMPT.format(entities_json=entities_json)

    try:
        result = await invoke_llm_structured(
            prompt, NPCGenerationResponse, max_tokens=8192,
        )
        npcs = [n.model_dump() for n in result.npcs]
        relationships = [r.model_dump() for r in result.relationships]
        logger.info(
            "generate_npcs: LLM returned %d NPCs, %d relationships",
            len(npcs), len(relationships),
        )
    except Exception:
        logger.exception("generate_npcs: structured output failed")
        npcs, relationships = [], []

    # Fallback if LLM returned insufficient data.
    if len(npcs) < MAX_NPCS:
        logger.warning(
            "generate_npcs: only %d/%d NPCs, using fallback", len(npcs), MAX_NPCS,
        )
        npcs, relationships = _make_fallback_npcs()

    # Ensure exactly MAX_NPCS NPCs and valid positions.
    npcs = npcs[:MAX_NPCS]
    npcs = _clamp_positions(npcs)

    return {
        "npcs": npcs,
        "relationships": relationships,
        "current_round": 0,
    }
