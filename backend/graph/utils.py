"""Shared utilities for LangGraph node implementations."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from pydantic import BaseModel

logger = logging.getLogger(__name__)


def parse_llm_json(content: str, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    """Extract a JSON object from LLM output, tolerating markdown fences or preamble.

    Tries ``json.loads`` first, then falls back to regex extraction of the
    outermost ``{...}`` block.  Returns *fallback* (default empty dict) when
    parsing fails entirely.
    """
    if fallback is None:
        fallback = {}

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    json_match = re.search(r"\{.*\}", content, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    return fallback


def clamp(value: float, lo: float, hi: float) -> float:
    """Clamp *value* to the range [lo, hi]."""
    return max(lo, min(hi, value))


def validate_and_collect(
    raw_items: list[dict[str, Any]],
    model_class: type[BaseModel],
) -> list[dict[str, Any]]:
    """Validate each dict against *model_class*, returning those that pass.

    Invalid items are logged and skipped instead of silently swallowed.
    """
    results: list[dict[str, Any]] = []
    for raw in raw_items:
        try:
            results.append(model_class(**raw).model_dump())
        except Exception:
            logger.warning("Validation failed for %s: %s", model_class.__name__, raw)
    return results


_NPC_ID_RE = re.compile(r"npc_(\d+)")


def normalize_npc_id(
    raw_id: str,
    name_to_id: dict[str, str] | None = None,
) -> str:
    """Normalize an NPC reference to the canonical ``npc_XX`` format.

    Handles:
    - ``npc_1`` → ``npc_01``
    - ``Citizen 2`` → ``npc_02`` (via name lookup)
    - ``marcus_rivera`` → ``npc_03`` (via snake_case / partial name lookup)
    """
    # Try direct regex match for npc_N or npc_NN format.
    m = _NPC_ID_RE.search(raw_id)
    if m:
        return f"npc_{int(m.group(1)):02d}"
    if not name_to_id:
        return raw_id
    # Try exact name lookup.
    if raw_id in name_to_id:
        return name_to_id[raw_id]
    # Try case-insensitive / snake_case matching.
    # Also strip "npc_" prefix if present (e.g. "npc_elias" → "elias").
    stripped = raw_id.removeprefix("npc_") if raw_id.startswith("npc_") else raw_id
    normalized = stripped.replace("_", " ").strip().lower()
    for name, npc_id in name_to_id.items():
        if name.lower() == normalized:
            return npc_id
    # Try partial match (first or last name).
    for name, npc_id in name_to_id.items():
        parts = name.lower().split()
        if normalized in parts:
            return npc_id
    return raw_id
