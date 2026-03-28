"""Shared LLM client factory for graph nodes."""

from __future__ import annotations

from langchain_openai import ChatOpenAI

from config import settings
from graph.utils import parse_llm_json


def get_llm(max_tokens: int = 4096) -> ChatOpenAI:
    """Create a ChatOpenAI instance for the currently configured model."""
    return ChatOpenAI(
        model=settings.model_name,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        max_tokens=max_tokens,
    )


async def invoke_llm_json(
    prompt: str,
    max_tokens: int = 4096,
    fallback: dict | None = None,
    llm: ChatOpenAI | None = None,
) -> dict:
    """Invoke the LLM and parse the JSON response in one call.

    If *llm* is provided it is reused (useful for batching many calls with
    a shared client); otherwise a fresh instance is created via ``get_llm``.
    """
    if llm is None:
        llm = get_llm(max_tokens=max_tokens)
    response = await llm.ainvoke(prompt)
    content: str = response.content  # type: ignore[assignment]
    return parse_llm_json(content, fallback=fallback)
