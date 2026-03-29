from __future__ import annotations

import operator
from typing import Annotated, Any, TypedDict


class SimState(TypedDict):
    policy_text: str
    entities: list[dict[str, Any]]
    npcs: list[dict[str, Any]]
    relationships: list[dict[str, Any]]
    events: Annotated[list[dict[str, Any]], operator.add]
    current_round: int
    max_rounds: int
    memory_streams: dict[str, list[dict[str, Any]]]
