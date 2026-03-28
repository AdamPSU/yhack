from __future__ import annotations

import operator
from typing import Annotated, TypedDict


class SimState(TypedDict):
    policy_text: str
    entities: list[dict]
    npcs: list[dict]
    relationships: list[dict]
    events: Annotated[list[dict], operator.add]
    current_round: int
    max_rounds: int
