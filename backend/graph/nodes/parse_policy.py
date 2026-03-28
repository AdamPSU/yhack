"""Node: parse incoming policy text into structured entities via LLM."""

from __future__ import annotations

from graph.llm import get_llm
from graph.prompts import PARSE_POLICY_PROMPT
from graph.utils import parse_llm_json
from models.state import SimState

_EMPTY_ENTITIES = {
    "sectors": [],
    "stakeholders": [],
    "economic_impacts": [],
    "controversy_level": "medium",
}


async def parse_policy(state: SimState) -> dict:
    """Analyse raw policy text and extract sectors, stakeholders, and impacts."""

    llm = get_llm(max_tokens=4096)

    prompt = PARSE_POLICY_PROMPT.format(policy_text=state["policy_text"])
    response = await llm.ainvoke(prompt)
    content: str = response.content  # type: ignore[assignment]

    entities = parse_llm_json(content, fallback=_EMPTY_ENTITIES)

    return {"entities": [entities]}
