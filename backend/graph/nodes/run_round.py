"""Node: execute one simulation round — every NPC perceives, reacts, and acts."""

from __future__ import annotations

import asyncio

from langchain_openai import ChatOpenAI

from config import MAX_X, MAX_Y
from graph.llm import get_llm
from graph.prompts import NPC_ROUND_PROMPT
from graph.utils import parse_llm_json
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


def _build_neighbor_ids(npc: dict, all_npcs: list[dict], radius: int = 2) -> list[str]:
    """Return IDs of NPCs within *radius* tiles (Chebyshev distance)."""
    npc_id = npc.get("id", "")
    nx, ny = npc.get("x", 0), npc.get("y", 0)
    neighbors: list[str] = []
    for other in all_npcs:
        oid = other.get("id", "")
        if oid == npc_id:
            continue
        dx = abs(other.get("x", 0) - nx)
        dy = abs(other.get("y", 0) - ny)
        if max(dx, dy) <= radius:
            neighbors.append(oid)
    return neighbors


def _format_nearby_npcs(npc: dict, all_npcs: list[dict], radius: int = 2) -> str:
    """List nearby NPCs with name, role, and mood."""
    neighbor_ids = set(_build_neighbor_ids(npc, all_npcs, radius))
    if not neighbor_ids:
        return "Nobody is nearby right now."
    lines: list[str] = []
    for other in all_npcs:
        if other.get("id") in neighbor_ids:
            lines.append(
                f"- {other.get('name', '?')} ({other.get('role', '?')}, mood: {other.get('mood', '?')})"
            )
    return "\n".join(lines)


def _format_neighbor_events(
    neighbor_ids: list[str],
    events: list[dict],
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


def _build_round_context(current_round: int, max_rounds: int, events: list[dict]) -> str:
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


def _policy_summary(entities: list[dict]) -> str:
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
    npc: dict,
    state: SimState,
    llm: ChatOpenAI,
    policy_text: str,
    neighbor_events_str: str,
    round_context: str,
    nearby_npcs: str,
) -> list[dict]:
    """Run the Perceive-React-Act loop for one NPC and return its events."""

    current_round = state["current_round"]
    max_rounds = state["max_rounds"]

    prompt = NPC_ROUND_PROMPT.format(
        npc_name=npc.get("name", "Unknown"),
        npc_role=npc.get("role", "worker"),
        npc_industry=npc.get("industry", "general"),
        npc_income=npc.get("income_level", "medium"),
        npc_leaning=f'{npc.get("political_leaning", 0.0)} ({_political_label(npc.get("political_leaning", 0.0))})',
        npc_personality=npc.get("personality", "Ordinary person."),
        npc_mood=npc.get("mood", "neutral"),
        npc_x=npc.get("x", 0),
        npc_y=npc.get("y", 0),
        policy_summary=policy_text,
        current_round=current_round + 1,  # Display as 1-indexed for the LLM.
        max_rounds=max_rounds,
        round_context=round_context,
        nearby_npcs=nearby_npcs,
        neighbor_events=neighbor_events_str,
    )

    response = await llm.ainvoke(prompt)
    content: str = response.content  # type: ignore[assignment]

    data = parse_llm_json(content, fallback={"events": []})

    raw_events: list[dict] = data.get("events", [])
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
    npc_id = npc.get("id", "unknown")
    sim_events: list[dict] = []
    for ev in raw_events:
        sim_events.append(
            {
                "round": current_round,
                "npc_id": npc_id,
                "event_type": ev.get("event_type", "chat"),
                "message": ev.get("message", ""),
                "data": ev.get("data", {}),
            }
        )

    return sim_events


async def run_round(state: SimState) -> dict:
    """Run one simulation round for all 25 NPCs in parallel."""

    llm = get_llm(max_tokens=2048)

    npcs = state["npcs"]
    events = state.get("events", [])
    current_round = state["current_round"]
    max_rounds = state["max_rounds"]

    policy_text = _policy_summary(state.get("entities", []))
    round_context = _build_round_context(current_round, max_rounds, events)

    # Build per-NPC tasks.
    tasks = []
    for npc in npcs:
        neighbor_ids = _build_neighbor_ids(npc, npcs)
        neighbor_events_str = _format_neighbor_events(neighbor_ids, events, current_round)
        nearby_npcs_str = _format_nearby_npcs(npc, npcs)

        tasks.append(
            _simulate_single_npc(
                npc=npc,
                state=state,
                llm=llm,
                policy_text=policy_text,
                neighbor_events_str=neighbor_events_str,
                round_context=round_context,
                nearby_npcs=nearby_npcs_str,
            )
        )

    # Fire all 25 NPC calls concurrently.
    results: list[list[dict]] = await asyncio.gather(*tasks)

    # Flatten.
    all_events: list[dict] = []
    for npc_events in results:
        all_events.extend(npc_events)

    # Build position lookup for movement clamping.
    npc_positions = {npc.get("id", ""): (npc.get("x", 0), npc.get("y", 0)) for npc in npcs}

    # Update NPC moods based on mood_shift events from this round.
    mood_updates: dict[str, str] = {}
    move_updates: dict[str, tuple[int, int]] = {}
    for ev in all_events:
        if ev["event_type"] == "mood_shift":
            new_mood = ev.get("data", {}).get("new_mood")
            if new_mood:
                mood_updates[ev["npc_id"]] = new_mood
        elif ev["event_type"] == "move":
            to_x = ev.get("data", {}).get("to_x")
            to_y = ev.get("data", {}).get("to_y")
            if to_x is not None and to_y is not None:
                cur_x, cur_y = npc_positions.get(ev["npc_id"], (0, 0))
                # Clamp to 1-tile step, then clamp to grid bounds.
                clamped_x = max(0, min(MAX_X, max(cur_x - 1, min(cur_x + 1, int(to_x)))))
                clamped_y = max(0, min(MAX_Y, max(cur_y - 1, min(cur_y + 1, int(to_y)))))
                move_updates[ev["npc_id"]] = (clamped_x, clamped_y)

    updated_npcs = []
    for npc in npcs:
        npc_copy = dict(npc)
        npc_id = npc_copy.get("id", "")
        if npc_id in mood_updates:
            npc_copy["mood"] = mood_updates[npc_id]
        if npc_id in move_updates:
            npc_copy["x"], npc_copy["y"] = move_updates[npc_id]
        updated_npcs.append(npc_copy)

    return {
        "events": all_events,
        "current_round": current_round + 1,
        "npcs": updated_npcs,
    }
