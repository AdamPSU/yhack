"""Node: parse incoming policy text into structured entities via LLM."""

from __future__ import annotations

from graph.llm import invoke_llm_json
from graph.prompts import PARSE_POLICY_PROMPT
from models.state import SimState

_EMPTY_ENTITIES = {
    "sectors": [],
    "stakeholders": [],
    "economic_impacts": [],
    "controversy_level": "medium",
}


async def parse_policy(state: SimState) -> dict:
    """Analyse raw policy text and extract sectors, stakeholders, and impacts."""

    prompt = PARSE_POLICY_PROMPT.format(policy_text=state["policy_text"])
    entities = await invoke_llm_json(prompt, max_tokens=4096, fallback=_EMPTY_ENTITIES)

    return {"entities": [entities]}
