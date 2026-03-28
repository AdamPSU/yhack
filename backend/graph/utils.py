"""Shared utilities for LangGraph node implementations."""

from __future__ import annotations

import json
import logging
import re

from pydantic import BaseModel

logger = logging.getLogger(__name__)


def parse_llm_json(content: str, fallback: dict | None = None) -> dict:
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


def clamp(value: float | int, lo: float | int, hi: float | int) -> float | int:
    """Clamp *value* to the range [lo, hi]."""
    return max(lo, min(hi, value))


def validate_and_collect(
    raw_items: list[dict],
    model_class: type[BaseModel],
) -> list[dict]:
    """Validate each dict against *model_class*, returning those that pass.

    Invalid items are logged and skipped instead of silently swallowed.
    """
    results: list[dict] = []
    for raw in raw_items:
        try:
            results.append(model_class(**raw).model_dump())
        except Exception:
            logger.warning("Validation failed for %s: %s", model_class.__name__, raw)
    return results
