"""Shared utilities for LangGraph node implementations."""

from __future__ import annotations

import json
import re


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
