"""Node: orchestrate NPC generation — extract from source, fill gaps with RNG + LLM personality."""

from __future__ import annotations

import asyncio
import json
import logging
import random

from langchain_openai import ChatOpenAI

from config import GRID_HEIGHT, GRID_WIDTH, MAX_NPCS, MAX_X, MAX_Y
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
    "INTJ",
    "INTP",
    "ENTJ",
    "ENTP",
    "INFJ",
    "INFP",
    "ENFJ",
    "ENFP",
    "ISTJ",
    "ISFJ",
    "ESTJ",
    "ESFJ",
    "ISTP",
    "ISFP",
    "ESTP",
    "ESFP",
]
_MOODS = [
    "hopeful",
    "anxious",
    "angry",
    "neutral",
    "excited",
    "worried",
    "skeptical",
    "determined",
]
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


async def _extract_characters(
    source_text: str, entities_json: str, llm: ChatOpenAI
) -> list[dict]:
    """Try to extract named characters from the source text."""
    prompt = EXTRACT_CHARACTERS_PROMPT.format(
        source_text=source_text[:4000],
        entities_json=entities_json,
    )
    response = await llm.ainvoke(prompt)
    data = parse_llm_json(response.content, fallback={"characters": []})  # type: ignore[arg-type]
    return data.get("characters", [])


async def _generate_personality(
    base: dict, entities_json: str, llm: ChatOpenAI
) -> dict:
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


async def _generate_relationships(
    npcs: list[dict], entities_json: str, llm: ChatOpenAI
) -> list[dict]:
    """Generate a social network across the assembled NPC roster."""
    summary_lines = [
        f"{n['id']}: {n.get('name', '?')} — {n.get('profession', '?')} x={n.get('x')}, y={n.get('y')}"
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


def _initial_reputation(npc: dict) -> float:
    """Heuristic for starting reputation based on social standing."""
    rep = 0.5
    if npc.get("income_level") == "high":
        rep += 0.1
    elif npc.get("income_level") == "low":
        rep -= 0.05

    prof = npc.get("profession", "").lower()
    if any(
        k in prof for k in ["doctor", "lawyer", "owner", "professor", "judge", "mayor"]
    ):
        rep += 0.2
    if any(k in prof for k in ["activist", "drifter", "protester"]):
        rep -= 0.1
    return round(max(0.1, min(0.95, rep)), 2)


async def generate_npcs(state: SimState) -> dict:
    num_npcs = state.get("num_npcs", MAX_NPCS)
    logger.info("generate_npcs: starting for %d NPCs …", num_npcs)
    llm = get_llm(max_tokens=1024, tier="fast")
    entities_json = json.dumps(state["entities"])
    callback = state.get("npc_added_callback")

    extracted = await _extract_characters(state["policy_text"], entities_json, llm)
    extracted = extracted[:num_npcs]
    logger.info("generate_npcs: extracted %d characters from policy", len(extracted))

    used_names: set[str] = {c.get("name", "") for c in extracted if c.get("name")}

    # Process extracted NPCs to have base attributes for personality generation
    npc_bases: list[dict] = []
    for i, char in enumerate(extracted):
        char.setdefault("gender", random.choice(["male", "female", "nonbinary"]))
        char.setdefault("mbti", random.choice(_MBTI_TYPES))
        char.setdefault("country", "USA")
        char.setdefault("income_level", random.choice(_INCOME_LEVELS))
        char.setdefault("political_leaning", round(random.uniform(-1.0, 1.0), 2))
        char.setdefault("x", random.randint(0, MAX_X))
        char.setdefault("y", random.randint(0, MAX_Y))
        char.setdefault("mood", random.choice(_MOODS))
        char.setdefault("bio", "A resident of Millfield.")
        npc_bases.append(char)

    needed = num_npcs - len(npc_bases)
    if needed > 0:
        logger.info("generate_npcs: generating %d random NPC bases …", needed)
        npc_bases.extend(
            [_random_base(len(npc_bases) + i, used_names) for i in range(needed)]
        )

    logger.info("generate_npcs: generating personalities for %d NPCs …", len(npc_bases))
    tasks = [
        asyncio.ensure_future(_generate_personality(b, entities_json, llm))
        for b in npc_bases
    ]

    npcs: list[dict] = []
    # Using enumerate with as_completed results in unordered IDs, which is fine, but we should make sure they are unique
    for i, future in enumerate(asyncio.as_completed(tasks)):
        npc = await future
        npc["id"] = f"npc_{i + 1:02d}"
        npc.setdefault("country", "USA")
        npc.setdefault("profession", "local resident")
        npc.setdefault("interested_topics", ["local economy"])
        # Ensure LLM-provided beliefs and controversial ideas are captured, fallback only if missing
        if not npc.get("beliefs"):
            npc["beliefs"] = ["Community matters.", "Economic stability is key."]
        if not npc.get("controversial_ideas"):
            npc["controversial_ideas"] = []
        npc.setdefault("category", "resident")
        npc["reputation"] = _initial_reputation(npc)
        npcs.append(npc)
        if callback:
            await callback(npc)

    logger.info("generate_npcs: generating relationships …")
    rel_llm = get_llm(max_tokens=2048, tier="fast")
    relationships = await _generate_relationships(npcs, entities_json, rel_llm)

    # Ensure all relationships have affinity and trust
    for rel in relationships:
        rel.setdefault(
            "affinity", round(random.uniform(-0.1, 0.3), 2)
        )  # Default slightly positive/neutral
        rel.setdefault("trust", round(random.uniform(0.3, 0.7), 2))

    logger.info("generate_npcs: created %d relationships", len(relationships))

    npcs = _clamp_positions(npcs)
    return {
        "npcs": npcs,
        "relationships": relationships,
        "current_round": 0,
        "memory_streams": {npc["id"]: [] for npc in npcs},
    }
