"""Shared LLM client factory for graph nodes."""

from __future__ import annotations

import logging
from typing import Any, TypeVar

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from config import settings
from graph.utils import parse_llm_json

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def get_llm(max_tokens: int = 4096) -> ChatOpenAI:
    """Create a ChatOpenAI instance for the currently configured model."""
    return ChatOpenAI(
        model=settings.model_name,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        max_tokens=max_tokens,  # pyright: ignore[reportCallIssue]
    )


async def invoke_llm_structured(
    prompt: str,
    response_model: type[T],
    max_tokens: int = 4096,
    llm: ChatOpenAI | None = None,
) -> T:
    """Invoke the LLM with Pydantic structured output.

    Uses ``with_structured_output`` to guarantee the response matches
    *response_model*. If *llm* is provided it is reused.
    """
    if llm is None:
        llm = get_llm(max_tokens=max_tokens)
    structured_llm = llm.with_structured_output(response_model)
    result = await structured_llm.ainvoke(prompt)
    return result  # type: ignore[return-value]


async def invoke_llm_json(
    prompt: str,
    max_tokens: int = 4096,
    fallback: dict[str, Any] | None = None,
    llm: ChatOpenAI | None = None,
) -> dict[str, Any]:
    """Invoke the LLM and parse the JSON response in one call.

    Fallback path for when structured output is not suitable.
    If *llm* is provided it is reused.
    """
    if llm is None:
        llm = get_llm(max_tokens=max_tokens)
    response = await llm.ainvoke(prompt)
    content: str = response.content  # pyright: ignore[reportAssignmentType,reportUnknownVariableType]
    return parse_llm_json(content, fallback=fallback)
