"""Node: assemble policy text from uploaded PDF sources."""

from __future__ import annotations

from typing import Any

from models.state import SimState
from services.context_store import get_source


async def build_context(state: SimState) -> dict[str, Any]:
    policy_ids = state.get("policy_sources") or []
    parts: list[str] = []

    for source_id in policy_ids:
        src = get_source(source_id)
        if src is None:
            raise ValueError(f"Policy source {source_id} was not found.")
        body = (src.get("content_text") or "").strip()
        if body:
            label = src.get("filename") or source_id
            parts.append(f"--- Source: {label} ---\n{body}")

    notes_text = (state.get("notes_text", "") or "").strip()
    if notes_text:
        parts.append(f"--- Author notes ---\n{notes_text}")

    merged_policy = "\n\n".join(parts).strip()
    if not merged_policy:
        raise ValueError("Policy content is empty.")

    return {
        "policy_text": merged_policy,
        "trend_summary": "",
        "context_summary": "",
        "indicator_snapshots": [],
        "source_summaries": [],
    }
