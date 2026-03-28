"""Node: execute one simulation round — every NPC perceives, reacts, and acts.

Opinion dynamics based on Peralta, Kertész & Iñiguez (2022),
"Opinion dynamics in social networks: From models to data" (arXiv:2201.01322).
Implements Deffuant bounded confidence (Eq. 1-2), Baumann controversy
amplification (Eq. 6), and keep/compromise/adopt behavioral classification.
"""

from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

from langchain_openai import ChatOpenAI

from config import MAX_X, MAX_Y
from graph.llm import get_llm, invoke_llm_structured
from graph.prompts import NPC_ROUND_PROMPT
from graph.utils import clamp, normalize_npc_id
from models.schemas import NPCRoundResponse, SimEvent

logger = logging.getLogger(__name__)
from models.state import SimState


def _political_label(value: float) -> str:
    """Human-readable political leaning."""
    if value <= -0.6:
        return "strongly progressive"
    if value <= -0.2:
        return "leaning progressive"
    if value <= 0.2:
        return "moderate/centrist"
    if value <= 0.6:
        return "leaning conservative"
    return "strongly conservative"


_TYPE_WEIGHTS = {
    "family": 1.5,
    "friend": 1.2,
    "employer": 1.0,
    "colleague": 0.8,
    "neighbor": 0.5,
}

# --- Opinion dynamics constants (Peralta et al. 2022) ---

# Mood represented as continuous value in [0, 1] for Deffuant dynamics.
_MOOD_LADDER = ["angry", "anxious", "worried", "skeptical", "neutral", "determined", "hopeful", "excited"]
_MOOD_TO_CONTINUOUS = {m: i / (len(_MOOD_LADDER) - 1) for i, m in enumerate(_MOOD_LADDER)}
_MOOD_BREAKPOINTS = [i / (len(_MOOD_LADDER) - 1) for i in range(len(_MOOD_LADDER))]

# Deffuant bounded confidence parameters (Eq. 1-2).
_MU_POLITICAL = 0.3  # Convergence rate for political leaning.
_MU_MOOD = 0.4  # Convergence rate for mood (moods shift faster than politics).
_EPSILON_POLITICAL = 0.7  # Confidence bound: only interact if |x_i - x_j| < ε.
_EPSILON_MOOD = 1.1  # No effective bound for mood (emotions are always contagious).

# Baumann controversy amplification (Eq. 6): α parameter per controversy level.
_CONTROVERSY_ALPHA = {"low": 1.0, "medium": 2.0, "high": 3.5}

# Keep/compromise/adopt thresholds from Chacoma & Zanette (2015), Sec. 3.3.
_ADOPT_THRESHOLD = 0.85  # I_ij above this → adopt (copy opinion).
_COMPROMISE_THRESHOLD = 0.25  # I_ij above this → compromise (Deffuant update).

# Keyword-based fuzzy mood mapping. First matching substring wins.
_MOOD_KEYWORDS: list[tuple[str, str]] = [
    ("angry", "angry"), ("furious", "angry"), ("outrag", "angry"),
    ("anxi", "anxious"), ("nervous", "anxious"), ("fear", "anxious"),
    ("dread", "anxious"), ("frustr", "anxious"),
    ("worr", "worried"), ("concern", "worried"), ("skeptic", "worried"),
    ("disappoint", "worried"), ("uneasy", "worried"),
    ("neutral", "neutral"), ("indifferen", "neutral"), ("ambivalen", "neutral"),
    ("hope", "hopeful"), ("optim", "hopeful"), ("cautious", "hopeful"),
    ("content", "hopeful"), ("determin", "hopeful"), ("resolut", "hopeful"),
    ("pleas", "hopeful"), ("satisf", "hopeful"), ("confiden", "hopeful"),
    ("excit", "excited"), ("thrill", "excited"), ("elat", "excited"),
]


def _fuzzy_mood_to_ladder(mood: str) -> str:
    """Map an arbitrary mood string to the closest ``_MOOD_LADDER`` value."""
    low = mood.lower().strip()
    if low in _MOOD_TO_CONTINUOUS:
        return low
    for keyword, ladder_mood in _MOOD_KEYWORDS:
        if keyword in low:
            return ladder_mood
    return "neutral"


def _build_relationship_map(
    relationships: list[dict[str, Any]],
) -> dict[str, list[tuple[str, str, float]]]:
    """Pre-index relationships as {npc_id: [(other_id, rel_type, strength), ...]}.

    Deduplicates: if the same pair appears multiple times (e.g. as both
    colleague and neighbor), only the entry with the highest effective
    influence (strength × type_weight) is kept.
    """
    # First pass: pick the strongest relationship per directed pair.
    best: dict[tuple[str, str], tuple[str, float, float]] = {}  # (src,tgt) → (rtype, strength, eff)
    for rel in relationships:
        src: str = rel.get("source_id", "")
        tgt: str = rel.get("target_id", "")
        rtype: str = rel.get("rel_type", "neighbor")
        strength = float(rel.get("strength", 0.5))
        eff = strength * _TYPE_WEIGHTS.get(rtype, 0.5)
        for pair in [(src, tgt), (tgt, src)]:
            prev = best.get(pair)
            if prev is None or eff > prev[2]:
                best[pair] = (rtype, strength, eff)

    # Second pass: build the map from deduplicated entries.
    rel_map: dict[str, list[tuple[str, str, float]]] = {}
    for (src, tgt), (rtype, strength, _) in best.items():
        rel_map.setdefault(src, []).append((tgt, rtype, strength))
    return rel_map


def _build_neighbor_ids(npc: dict[str, Any], all_npcs: list[dict[str, Any]], radius: int = 2) -> list[str]:
    """Return IDs of NPCs within *radius* tiles (Chebyshev distance)."""
    npc_id: str = npc.get("id", "")
    nx: int = npc.get("x", 0)
    ny: int = npc.get("y", 0)
    neighbors: list[str] = []
    for other in all_npcs:
        oid: str = other.get("id", "")
        if oid == npc_id:
            continue
        dx = abs(other.get("x", 0) - nx)
        dy = abs(other.get("y", 0) - ny)
        if max(dx, dy) <= radius:
            neighbors.append(oid)
    return neighbors


def _format_nearby_npcs(
    neighbor_ids: list[str],
    all_npcs: list[dict[str, Any]],
    npc_rels: list[tuple[str, str, float]],
) -> str:
    """List nearby NPCs with name, role, mood, and relationship annotation."""
    if not neighbor_ids:
        return "Nobody is nearby right now."
    id_set = set(neighbor_ids)
    rel_lookup = {other_id: (rtype, strength) for other_id, rtype, strength in npc_rels}
    lines: list[str] = []
    for other in all_npcs:
        oid = other.get("id")
        if oid in id_set:
            line = f"- {other.get('name', '?')} ({other.get('profession', '?')})"
            if oid in rel_lookup:
                rtype, strength = rel_lookup[oid]
                line += f" [your {rtype}, closeness: {strength:.1f}]"
            else:
                line += " [stranger]"
            lines.append(line)
    return "\n".join(lines)


def _format_social_targets(
    npc: dict[str, Any],
    npc_rels: list[tuple[str, str, float]],
    neighbor_ids: list[str],
    all_npcs: list[dict[str, Any]],
) -> str:
    """Identify strong social ties not currently nearby, with direction hints."""
    if not npc_rels:
        return "You have no strong social connections in town."

    npc_x, npc_y = npc.get("x", 0), npc.get("y", 0)
    neighbor_set = set(neighbor_ids)
    npc_lookup: dict[str | None, dict[str, Any]] = {n.get("id"): n for n in all_npcs}

    candidates: list[tuple[float, str, str, float, str, int]] = []
    for other_id, rtype, strength in npc_rels:
        if other_id in neighbor_set:
            continue
        other = npc_lookup.get(other_id)
        if not other:
            continue
        ox, oy = other.get("x", 0), other.get("y", 0)
        dist = max(abs(ox - npc_x), abs(oy - npc_y))
        pull = strength * _TYPE_WEIGHTS.get(rtype, 0.5)
        dx, dy = ox - npc_x, oy - npc_y
        dirs: list[str] = []
        if dy < 0:
            dirs.append("north")
        if dy > 0:
            dirs.append("south")
        if dx > 0:
            dirs.append("east")
        if dx < 0:
            dirs.append("west")
        direction = "-".join(dirs) if dirs else "here"
        candidates.append((pull, other.get("name", "?"), other_id, rtype, strength, direction, dist))

    if not candidates:
        return "All your social connections are nearby already."

    candidates.sort(key=lambda c: c[0], reverse=True)
    lines: list[str] = []
    for _, name, oid, rtype, strength, direction, dist in candidates[:3]:
        lines.append(f"- {name} [{oid}] (your {rtype}, closeness: {strength:.1f}) — {dist} tiles {direction}")
    return "\n".join(lines)


def _format_neighbor_events(
    neighbor_ids: list[str],
    events: list[dict[str, Any]],
    current_round: int,
) -> str:
    """Summarise what neighboring NPCs did in the previous round."""
    if current_round == 0 or not events:
        return "This is the first round — no neighbor actions yet."

    prev_round = current_round - 1
    relevant = [
        e for e in events
        if e.get("round") == prev_round and e.get("npc_id") in neighbor_ids
    ]

    if not relevant:
        return "Your neighbors were quiet last round — nothing noteworthy happened nearby."

    lines: list[str] = []
    for ev in relevant:
        lines.append(f"- [{ev.get('event_type', '?')}] {ev.get('message', '(no details)')}")
    return "\n".join(lines)


def _build_round_context(current_round: int, max_rounds: int, events: list[dict[str, Any]]) -> str:
    """Provide a brief high-level summary of how the simulation is going."""
    if current_round == 0:
        return "The policy was just announced. People are hearing about it for the first time."

    prev_events = [e for e in events if e.get("round") == current_round - 1]
    total_events = len(prev_events)
    protests = sum(1 for e in prev_events if e.get("event_type") == "protest")
    mood_shifts = sum(1 for e in prev_events if e.get("event_type") == "mood_shift")

    parts: list[str] = [f"Last round saw {total_events} total actions across town."]
    if protests:
        parts.append(f"{protests} protest(s) broke out.")
    if mood_shifts:
        parts.append(f"{mood_shifts} people experienced a change in mood.")
    if current_round >= max_rounds - 1:
        parts.append("This is the final round — make it count.")
    return " ".join(parts)


def _policy_summary(entities: list[dict[str, Any]]) -> str:
    """Condense parsed policy entities into a readable summary for NPCs."""
    if not entities:
        return "A new economic policy has been announced, but details are unclear."

    e = entities[0]
    sectors = ", ".join(e.get("sectors", [])[:6]) or "various sectors"
    impacts: list[str] = []
    for imp in e.get("economic_impacts", [])[:4]:
        direction = imp.get("direction", "unknown")
        desc = imp.get("description", "")
        if desc:
            impacts.append(f"  - ({direction}) {desc}")
    impacts_str = "\n".join(impacts) if impacts else "  - Details still emerging"
    controversy = e.get("controversy_level", "medium")

    return (
        f"A new policy affecting {sectors} has been announced.\n"
        f"Key expected impacts:\n{impacts_str}\n"
        f"Controversy level: {controversy}"
    )


async def _simulate_single_npc(
    npc: dict[str, Any],
    state: SimState,
    llm: ChatOpenAI,
    policy_text: str,
    neighbor_events_str: str,
    round_context: str,
    nearby_npcs: str,
    social_targets: str,
    name_to_id: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Run the Perceive-React-Act loop for one NPC and return its events."""

    current_round = state["current_round"]
    max_rounds = state["max_rounds"]

    prompt = NPC_ROUND_PROMPT.format(
        npc_name=npc.get("name", "Unknown"),
        npc_gender=npc.get("gender", ""),
        npc_profession=npc.get("profession", "local resident"),
        npc_country=npc.get("country", "USA"),
        npc_mbti=npc.get("mbti", ""),
        npc_bio=npc.get("bio", ""),
        npc_persona=npc.get("persona", ""),
        npc_interested_topics=", ".join(npc.get("interested_topics", [])),
        npc_income=npc.get("income_level", "medium"),
        npc_leaning=f'{npc.get("political_leaning", 0.0)} ({_political_label(npc.get("political_leaning", 0.0))})',
        npc_x=npc.get("x", 0),
        npc_y=npc.get("y", 0),
        policy_summary=policy_text,
        current_round=current_round + 1,
        max_rounds=max_rounds,
        round_context=round_context,
        nearby_npcs=nearby_npcs,
        social_targets=social_targets,
        neighbor_events=neighbor_events_str,
    )

    try:
        result = await invoke_llm_structured(
            prompt, NPCRoundResponse, llm=llm,
        )
        raw_events = [ev.model_dump() for ev in result.events]
    except Exception:
        logger.warning("NPC %s structured output failed, using fallback", npc.get("name"))
        raw_events = []

    if not raw_events:
        # Guarantee at least one event per NPC per round.
        raw_events = [
            {
                "event_type": "chat",
                "message": f'{npc.get("name", "Someone")} is processing the news quietly.',
                "data": {"dialogue": "Hmm, I need to think about this..."},
            }
        ]

    # Tag each event with round and NPC id.
    npc_id: str = npc.get("id", "unknown")
    sim_events: list[dict[str, Any]] = []
    for ev in raw_events:
        # Normalize target_npc_id so "npc_1" → "npc_01", "Citizen 2" → "npc_02", etc.
        ev_data = dict(ev.get("data", {}))
        if "target_npc_id" in ev_data:
            ev_data["target_npc_id"] = normalize_npc_id(
                ev_data["target_npc_id"], name_to_id
            )
        sim_events.append({
            "round": current_round,
            "npc_id": npc_id,
            "event_type": ev.get("event_type", "chat"),
            "message": ev.get("message", ""),
            "data": ev_data,
        })

    return sim_events


def _mood_to_continuous(mood: str) -> float:
    """Map a discrete mood string to [0, 1] for Deffuant dynamics."""
    mapped = _fuzzy_mood_to_ladder(mood)
    return _MOOD_TO_CONTINUOUS[mapped]


def _continuous_to_mood(value: float) -> str:
    """Map a continuous [0, 1] value back to the closest discrete mood."""
    value = clamp(value, 0.0, 1.0)
    best_idx = 0
    best_dist = abs(value - _MOOD_BREAKPOINTS[0])
    for i in range(1, len(_MOOD_BREAKPOINTS)):
        dist = abs(value - _MOOD_BREAKPOINTS[i])
        if dist < best_dist:
            best_dist = dist
            best_idx = i
    return _MOOD_LADDER[best_idx]


def _compute_influence_factor(
    speaker_id: str,
    target_id: str,
    rel_map: dict[str, list[tuple[str, str, float]]],
) -> float:
    """Compute I_ij influence factor from relationship data (Fig. 1c)."""
    rels = rel_map.get(speaker_id, [])
    rel_match = next(((rt, s) for oid, rt, s in rels if oid == target_id), None)
    if rel_match:
        rtype, strength = rel_match
        return min(1.0, strength * _TYPE_WEIGHTS.get(rtype, 0.5))
    return 0.1  # Stranger base influence.


def _apply_opinion_dynamics(
    npcs: list[dict[str, Any]],
    events: list[dict[str, Any]],
    current_round: int,
    rel_map: dict[str, list[tuple[str, str, float]]],
    controversy: str,
) -> list[dict[str, Any]]:
    """Apply opinion dynamics from Peralta et al. (2022) to NPC interactions.

    Combines three mechanisms:
    1. Deffuant bounded confidence (Eq. 1-2) for pairwise chat interactions.
    2. Baumann controversy amplification (Eq. 6) pushing opinions to extremes.
    3. Keep/compromise/adopt behavioral classification (Sec. 3.3).
    """
    npc_lookup = {n.get("id", ""): dict(n) for n in npcs}
    alpha = _CONTROVERSY_ALPHA.get(controversy, 2.0)

    chat_events = [
        e for e in events
        if e.get("round") == current_round and e.get("event_type") == "chat"
    ]

    for ev in chat_events:
        speaker_id = ev.get("npc_id", "")
        target_id = ev.get("data", {}).get("target_npc_id", "")
        if not target_id or target_id not in npc_lookup or speaker_id not in npc_lookup:
            continue

        speaker = npc_lookup[speaker_id]
        target = npc_lookup[target_id]
        i_ij = _compute_influence_factor(speaker_id, target_id, rel_map)

        # --- Classify behavior: keep / compromise / adopt (Sec. 3.3) ---
        if i_ij < _COMPROMISE_THRESHOLD:
            continue  # Keep: no opinion change.

        # --- Political leaning: Deffuant bounded confidence (Eq. 1-2) ---
        # x_i, x_j ∈ [-1, 1] — we normalize to [0, 1] for Deffuant, then back.
        x_i = (float(speaker.get("political_leaning", 0.0)) + 1.0) / 2.0
        x_j = (float(target.get("political_leaning", 0.0)) + 1.0) / 2.0

        if abs(x_i - x_j) < _EPSILON_POLITICAL:
            if i_ij >= _ADOPT_THRESHOLD:
                # Adopt: target copies speaker's opinion.
                new_x_j = x_i
            else:
                # Compromise: Deffuant update — x_j(t+1) = x_j + μ·I_ij·(x_i - x_j)
                new_x_j = x_j + _MU_POLITICAL * i_ij * (x_i - x_j)

            # Baumann controversy amplification (Eq. 6):
            # Nudge toward extremes proportional to tanh(α·x_j).
            # Discretized: x_j += dt · tanh(α · (2·x_j - 1)) where dt is small.
            centered = 2.0 * new_x_j - 1.0  # Map [0,1] back to [-1,1] for tanh.
            controversy_push = 0.05 * math.tanh(alpha * centered)
            new_x_j = clamp(new_x_j + controversy_push, 0.0, 1.0)

            # Map back to [-1, 1].
            npc_lookup[target_id]["political_leaning"] = round(new_x_j * 2.0 - 1.0, 4)

        # --- Mood: Deffuant bounded confidence on continuous mood ---
        m_i = _mood_to_continuous(speaker.get("mood", "neutral"))
        m_j = _mood_to_continuous(target.get("mood", "neutral"))

        if abs(m_i - m_j) < _EPSILON_MOOD:
            if i_ij >= _ADOPT_THRESHOLD:
                new_m_j = m_i
            else:
                # Negative moods spread more easily (asymmetric contagion).
                mu_effective = _MU_MOOD * (1.3 if m_i < m_j else 1.0)
                new_m_j = m_j + mu_effective * i_ij * (m_i - m_j)

            new_m_j = clamp(new_m_j, 0.0, 1.0)
            npc_lookup[target_id]["mood"] = _continuous_to_mood(new_m_j)

    # --- Baumann global controversy drift (Eq. 6) for all NPCs ---
    # Even without interaction, high-controversy policies push opinions outward.
    # dx_i/dt = -x_i + Σ A_ij · tanh(α · x_j)  →  simplified self-reinforcement term.
    if alpha > 1.5:
        for npc in npc_lookup.values():
            x = float(npc.get("political_leaning", 0.0))
            # Self-reinforcement: opinions drift away from center under controversy.
            drift = 0.02 * math.tanh(alpha * x)
            npc["political_leaning"] = round(clamp(x + drift, -1.0, 1.0), 4)

    return list(npc_lookup.values())


async def run_round(state: SimState) -> dict[str, Any]:
    """Run one simulation round for all 25 NPCs in parallel."""

    llm = get_llm(max_tokens=2048)

    npcs = state["npcs"]
    events = state.get("events", [])
    current_round = state["current_round"]
    max_rounds = state["max_rounds"]

    policy_text = _policy_summary(state.get("entities", []))
    round_context = _build_round_context(current_round, max_rounds, events)
    rel_map = _build_relationship_map(state.get("relationships", []))

    # Build name→id lookup so LLM references like "Citizen 2" can be resolved.
    name_to_id = {npc.get("name", ""): npc.get("id", "") for npc in npcs}

    # Build per-NPC tasks.
    tasks: list[Coroutine[Any, Any, list[dict[str, Any]]]] = []
    for npc in npcs:
        npc_id = npc.get("id", "")
        npc_rels = rel_map.get(npc_id, [])
        neighbor_ids = _build_neighbor_ids(npc, npcs)
        neighbor_events_str = _format_neighbor_events(neighbor_ids, events, current_round)
        nearby_npcs_str = _format_nearby_npcs(neighbor_ids, npcs, npc_rels)
        social_targets_str = _format_social_targets(npc, npc_rels, neighbor_ids, npcs)

        tasks.append(
            _simulate_single_npc(
                npc=npc,
                state=state,
                llm=llm,
                policy_text=policy_text,
                neighbor_events_str=neighbor_events_str,
                round_context=round_context,
                nearby_npcs=nearby_npcs_str,
                social_targets=social_targets_str,
                name_to_id=name_to_id,
            )
        )

    # Fire all 25 NPC calls concurrently.
    results: list[list[dict[str, Any]]] = await asyncio.gather(*tasks)

    # Flatten.
    all_events: list[dict[str, Any]] = []
    for npc_events in results:
        all_events.extend(npc_events)

    # --- Phase 1: Apply LLM mood_shift events BEFORE opinion dynamics ---
    # Individual reactions are the starting point; Deffuant then refines
    # based on social influence (matching the paper's model).
    npc_positions = {npc.get("id", ""): (npc.get("x", 0), npc.get("y", 0)) for npc in npcs}
    mood_updates: dict[str, str] = {}
    move_updates: dict[str, tuple[int, int]] = {}

    for ev in all_events:
        if ev["event_type"] == "mood_shift":
            new_mood = ev.get("data", {}).get("new_mood")
            if new_mood:
                mood_updates[ev["npc_id"]] = _fuzzy_mood_to_ladder(new_mood)
        elif ev["event_type"] == "move":
            to_x = ev.get("data", {}).get("to_x")
            to_y = ev.get("data", {}).get("to_y")
            if to_x is not None and to_y is not None:
                cur_x, cur_y = npc_positions.get(ev["npc_id"], (0, 0))
                stepped_x = max(cur_x - 1, min(cur_x + 1, int(to_x)))
                stepped_y = max(cur_y - 1, min(cur_y + 1, int(to_y)))
                move_updates[ev["npc_id"]] = (
                    int(clamp(stepped_x, 0, MAX_X)),
                    int(clamp(stepped_y, 0, MAX_Y)),
                )

    # Apply mood shifts before opinion dynamics.
    for npc in npcs:
        npc_id = npc.get("id", "")
        if npc_id in mood_updates:
            npc["mood"] = mood_updates[npc_id]

    # --- Phase 2: Apply opinion dynamics (Peralta et al. 2022) ---
    entities = state.get("entities", [])
    controversy = entities[0].get("controversy_level", "medium") if entities else "medium"
    npcs = _apply_opinion_dynamics(npcs, all_events, current_round, rel_map, controversy)

    # --- Phase 3: Apply movement updates ---
    updated_npcs = []
    for npc in npcs:
        npc_copy = dict(npc)
        npc_id = npc_copy.get("id", "")
        if npc_id in move_updates:
            npc_copy["x"], npc_copy["y"] = move_updates[npc_id]
        updated_npcs.append(npc_copy)

    return {
        "events": all_events,
        "current_round": current_round + 1,
        "npcs": updated_npcs,
    }
