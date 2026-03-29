"""Node: assemble authoritative policy text plus supporting trend context."""

from __future__ import annotations

from typing import Any

from models.state import SimState
from services.context_store import get_source, get_sources


def _format_indicator(indicator: dict[str, Any]) -> str:
    metric = indicator.get("metric", "metric")
    latest_value = indicator.get("latest_value")
    latest_period = indicator.get("latest_period") or "latest period"
    unit = indicator.get("unit") or ""
    trend = indicator.get("trend", "unknown")
    change = indicator.get("change")

    parts = [f"{metric}: {latest_value}{unit} at {latest_period}"]
    if change is not None:
        parts.append(f"change {change:+g}{unit}")
    parts.append(f"trend {trend}")
    return ", ".join(parts)


async def build_context(state: SimState) -> dict[str, Any]:
    primary_source = get_source(state["primary_policy_source"])
    if primary_source is None:
        raise ValueError("Primary policy PDF source was not found.")

    trend_sources = get_sources(state.get("trend_sources", []))
    notes_text = (state.get("notes_text", "") or "").strip()

    source_summaries: list[str] = []
    indicator_snapshots: list[dict[str, Any]] = []
    for source in trend_sources:
        summary = (source.get("summary", "") or "").strip()
        if summary:
            source_summaries.append(f'{source.get("filename", "trend.csv")}: {summary}')
        indicator_snapshots.extend(source.get("metadata", {}).get("indicator_snapshots", []))

    trend_lines = [_format_indicator(indicator) for indicator in indicator_snapshots[:8]]
    if not trend_lines and source_summaries:
        trend_lines = source_summaries[:3]
    trend_summary = "\n".join(f"- {line}" for line in trend_lines) or "No supporting historical CSV data was supplied."

    context_parts: list[str] = []
    if notes_text:
        context_parts.append(f"Supporting notes:\n{notes_text}")
    if trend_lines or source_summaries:
        context_parts.append(f"Historical trends:\n{trend_summary}")

    return {
        "policy_text": primary_source.get("content_text", "").strip(),
        "trend_summary": trend_summary,
        "context_summary": "\n\n".join(context_parts).strip(),
        "indicator_snapshots": indicator_snapshots,
        "source_summaries": source_summaries,
    }
