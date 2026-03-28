"""Node: orchestrate NPC generation — extract from source, fill gaps with GenerateRandom."""

from __future__ import annotations

import asyncio
import json
import random

from langchain_openai import ChatOpenAI

from config import GRID_HEIGHT, GRID_WIDTH, MAX_NPCS, MAX_X, MAX_Y
from graph.llm import get_llm
from graph.prompts import (
    EXTRACT_CHARACTERS_PROMPT,
    GENERATE_RANDOM_NPC_PROMPT,
    GENERATE_RELATIONSHIPS_PROMPT,
)
from graph.utils import parse_llm_json
from models.state import SimState

_MBTI_TYPES = [
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
]
_MOODS = ["hopeful", "anxious", "angry", "neutral", "excited", "worried", "skeptical", "determined"]
_INCOME_LEVELS = ["low", "medium", "high"]


def _apply_defaults(npc: dict, index: int) -> dict:
    """Fill any missing fields with lightweight deterministic defaults."""
    npc.setdefault("id", f"npc_{index + 1:02d}")
    npc.setdefault("gender", random.choice(["male", "female", "nonbinary"]))
    npc.setdefault("bio", "A longtime Millfield resident with deep roots in the community.")
    npc.setdefault("persona", "Quiet but observant; speaks plainly when they have something to say.")
    npc.setdefault("mbti", random.choice(_MBTI_TYPES))
    npc.setdefault("country", "USA")
    npc.setdefault("profession", npc.pop("role", "local resident"))
    npc.setdefault("interested_topics", ["local economy"])
    npc.setdefault("income_level", random.choice(_INCOME_LEVELS))
    npc.setdefault("political_leaning", round(random.uniform(-0.5, 0.5), 2))
    npc.setdefault("x", index % GRID_WIDTH)
    npc.setdefault("y", index // GRID_WIDTH)
    # mood is internal to opinion dynamics, not exposed in schema
    npc.setdefault("mood", random.choice(_MOODS))
    return npc


def _clamp_positions(npcs: list[dict]) -> list[dict]:
    """Ensure every NPC has valid, unique grid coordinates."""
    occupied: set[tuple[int, int]] = set()
    for npc in npcs:
        x = max(0, min(MAX_X, int(npc.get("x", 0))))
        y = max(0, min(MAX_Y, int(npc.get("y", 0))))
        while (x, y) in occupied:
            x = (x + 1) % GRID_WIDTH
            if x == 0:
                y = (y + 1) % GRID_HEIGHT
        occupied.add((x, y))
        npc["x"] = x
        npc["y"] = y
    return npcs


async def _extract_characters(source_text: str, entities_json: str, llm: ChatOpenAI) -> list[dict]:
    """Try to extract named characters or archetypes from the source text."""
    prompt = EXTRACT_CHARACTERS_PROMPT.format(
        source_text=source_text[:4000],  # Guard against very long inputs.
        entities_json=entities_json,
    )
    response = await llm.ainvoke(prompt)
    data = parse_llm_json(response.content, fallback={"characters": []})  # type: ignore[arg-type]
    return data.get("characters", [])


async def generate_random_npc(entities_json: str, existing_names: list[str], llm: ChatOpenAI) -> dict:
    """GenerateRandom — create one fully-specified NPC grounded in the policy world."""
    prompt = GENERATE_RANDOM_NPC_PROMPT.format(
        entities_json=entities_json,
        existing_names=", ".join(existing_names) if existing_names else "none",
    )
    response = await llm.ainvoke(prompt)
    data = parse_llm_json(response.content, fallback={})  # type: ignore[arg-type]
    return data


async def _generate_relationships(npcs: list[dict], entities_json: str, llm: ChatOpenAI) -> list[dict]:
    """Generate a social network across the assembled NPC roster."""
    summary_lines = [
        f'{n["id"]}: {n.get("name", "?")} — {n.get("profession", "?")} x={n.get("x")}, y={n.get("y")}'
        for n in npcs
    ]
    prompt = GENERATE_RELATIONSHIPS_PROMPT.format(npcs_summary="\n".join(summary_lines))
    response = await llm.ainvoke(prompt)
    data = parse_llm_json(response.content, fallback={"relationships": []})  # type: ignore[arg-type]
    return data.get("relationships", [])


async def generate_npcs(state: SimState) -> dict:
    llm = get_llm(max_tokens=4096)
    entities_json = json.dumps(state["entities"])

    extracted = await _extract_characters(state["policy_text"], entities_json, llm)
    extracted = extracted[:MAX_NPCS]

    npcs: list[dict] = []
    for i, char in enumerate(extracted):
        char["id"] = f"npc_{i + 1:02d}"
        npcs.append(_apply_defaults(char, i))

    needed = MAX_NPCS - len(npcs)
    if needed > 0:
        existing_names = [n["name"] for n in npcs]
        tasks = [generate_random_npc(entities_json, existing_names, llm) for _ in range(needed)]
        random_results = await asyncio.gather(*tasks)

        # Deduplicate names that collided across parallel calls.
        seen_names = set(existing_names)
        for npc in random_results:
            name = npc.get("name", "")
            if name in seen_names:
                npc["name"] = f"{name} Jr."
            seen_names.add(npc.get("name", ""))
            slot = len(npcs)
            npc["id"] = f"npc_{slot + 1:02d}"
            npcs.append(_apply_defaults(npc, slot))

    relationships = await _generate_relationships(npcs, entities_json, llm)

    npcs = _clamp_positions(npcs)
    return {"npcs": npcs, "relationships": relationships, "current_round": 0}
