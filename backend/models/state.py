from __future__ import annotations

import operator
from collections.abc import Awaitable, Callable
from typing import Annotated, Any, NotRequired, TypedDict


class SimState(TypedDict):
    policy_text: str
    objective: str
    entities: list[dict[str, Any]]
    npcs: list[dict[str, Any]]
    relationships: list[dict[str, Any]]
    events: Annotated[list[dict[str, Any]], operator.add]
    current_round: int
    max_rounds: int
    num_npcs: int
    map_id: NotRequired[str]
    memory_streams: dict[str, list[dict[str, Any]]]
    npc_stream_callback: NotRequired[Callable[[list[dict[str, Any]]], Awaitable[None]] | None]
