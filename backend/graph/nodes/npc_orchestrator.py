"""Node: orchestrate NPC generation — extract from source, fill gaps with RNG + LLM personality."""

from __future__ import annotations

import asyncio
import json
import logging
import random

from langchain_openai import ChatOpenAI

from config import GRID_HEIGHT, GRID_WIDTH, MAX_NPCS, MAX_X, MAX_Y, settings
from graph.llm import get_llm
from graph.names import FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES
from graph.prompts import (
    EXTRACT_CHARACTERS_PROMPT,
    GENERATE_NPC_PERSONALITY_PROMPT,
    GENERATE_RELATIONSHIPS_PROMPT,
)
from graph.utils import parse_llm_json
from models.state import SimState

logger = logging.getLogger(__name__)

_MBTI_TYPES = [
    "INTJ", "INTP", "ENTJ", "ENTP",
    "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ",
    "ISTP", "ISFP", "ESTP", "ESFP",
]
_MOODS = ["hopeful", "anxious", "angry", "neutral", "excited", "worried", "skeptical", "determined"]
_INCOME_LEVELS = ["low", "medium", "high"]


def _random_name(gender: str) -> str:
    pool = FIRST_NAMES_F if gender == "female" else FIRST_NAMES_M
    return f"{random.choice(pool)} {random.choice(LAST_NAMES)}"


def _random_base(index: int, used_names: set[str]) -> dict:
    """Generate all non-personality attributes via RNG."""
    gender = random.choice(["male", "female", "nonbinary"])
    name = _random_name("female" if gender == "female" else "male")
    # Ensure uniqueness without LLM involvement
    attempts = 0
    while name in used_names and attempts < 20:
        name = _random_name("female" if gender == "female" else "male")
        attempts += 1
    used_names.add(name)

    return {
        "name": name,
        "gender": gender,
        "mbti": random.choice(_MBTI_TYPES),
        "country": "USA",
        "income_level": random.choice(_INCOME_LEVELS),
        "political_leaning": round(random.uniform(-1.0, 1.0), 2),
        "x": random.randint(0, MAX_X),
        "y": random.randint(0, MAX_Y),
        "mood": random.choice(_MOODS),
    }


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
    """Try to extract named characters from the source text."""
    prompt = EXTRACT_CHARACTERS_PROMPT.format(
        source_text=source_text[:4000],
        entities_json=entities_json,
    )
    response = await llm.ainvoke(prompt)
    data = parse_llm_json(response.content, fallback={"characters": []})  # type: ignore[arg-type]
    return data.get("characters", [])


async def _generate_personality(base: dict, entities_json: str, llm: ChatOpenAI) -> dict:
    """Ask LLM only for personality fields; all other attrs are pre-generated."""
    prompt = GENERATE_NPC_PERSONALITY_PROMPT.format(
        name=base["name"],
        gender=base["gender"],
        income_level=base["income_level"],
        political_leaning=base["political_leaning"],
        mbti=base["mbti"],
        entities_json=entities_json,
    )
    response = await llm.ainvoke(prompt)
    data = parse_llm_json(response.content, fallback={})  # type: ignore[arg-type]
    return {**base, **data}


async def _generate_relationships(npcs: list[dict], entities_json: str, llm: ChatOpenAI) -> list[dict]:
    """Generate a social network across the assembled NPC roster."""
    summary_lines = [
        f'{n["id"]}: {n.get("name", "?")} — {n.get("profession", "?")} x={n.get("x")}, y={n.get("y")}'
        for n in npcs
    ]
    target_rels = max(15, int(len(npcs) * 1.5))
    prompt = GENERATE_RELATIONSHIPS_PROMPT.format(
        npcs_summary="\n".join(summary_lines),
        num_relationships=f"{target_rels}-{target_rels + 10}",
    )
    response = await llm.ainvoke(prompt)
    data = parse_llm_json(response.content, fallback={"relationships": []})  # type: ignore[arg-type]
    return data.get("relationships", [])


async def generate_npcs(state: SimState) -> dict:
    num_npcs = state.get("num_npcs", MAX_NPCS)
    logger.info("generate_npcs: starting for %d NPCs …", num_npcs)
    llm = get_llm(max_tokens=1024, model=settings.fast_model_name)
    entities_json = json.dumps(state["entities"])
    callback = state.get("npc_added_callback")

    extracted = await _extract_characters(state["policy_text"], entities_json, llm)
    extracted = extracted[:num_npcs]
    logger.info("generate_npcs: extracted %d characters from policy", len(extracted))

    used_names: set[str] = {c.get("name", "") for c in extracted if c.get("name")}
    npcs: list[dict] = []
    for i, char in enumerate(extracted):
        char["id"] = f"npc_{i + 1:02d}"
        char.setdefault("gender", random.choice(["male", "female", "nonbinary"]))
        char.setdefault("mbti", random.choice(_MBTI_TYPES))
        char.setdefault("country", "USA")
        char.setdefault("income_level", random.choice(_INCOME_LEVELS))
        char.setdefault("political_leaning", round(random.uniform(-1.0, 1.0), 2))
        char.setdefault("x", random.randint(0, MAX_X))
        char.setdefault("y", random.randint(0, MAX_Y))
        char.setdefault("mood", random.choice(_MOODS))
        char.setdefault("bio", "A longtime Millfield resident.")
        char.setdefault("persona", "Speaks plainly when they have something to say.")
        char.setdefault("profession", char.pop("role", "local resident"))
        char.setdefault("interested_topics", ["local economy"])
        char.setdefault("category", "resident")
        npcs.append(char)
        if callback:
            await callback(char)

    needed = num_npcs - len(npcs)
    if needed > 0:
        logger.info("generate_npcs: generating %d random NPCs …", needed)
        bases = [_random_base(len(npcs) + i, used_names) for i in range(needed)]
        tasks = [asyncio.ensure_future(_generate_personality(b, entities_json, llm)) for b in bases]
        slot_offset = len(npcs)
        for i, future in enumerate(asyncio.as_completed(tasks)):
            npc = await future
            npc["id"] = f"npc_{slot_offset + i + 1:02d}"
            npc.setdefault("profession", "local resident")
            npc.setdefault("interested_topics", ["local economy"])
            npc.setdefault("category", "resident")
            npcs.append(npc)
            if callback:
                await callback(npc)

    logger.info("generate_npcs: generating relationships …")
    rel_llm = get_llm(max_tokens=2048, model=settings.fast_model_name)
    relationships = await _generate_relationships(npcs, entities_json, rel_llm)
    logger.info("generate_npcs: created %d relationships", len(relationships))

    npcs = _clamp_positions(npcs)
    return {
        "npcs": npcs,
        "relationships": relationships,
        "current_round": 0,
        "memory_streams": {npc["id"]: [] for npc in npcs},
    }
