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


def _supports_reasoning_effort(model_name: str, base_url: str) -> bool:
    """Return True only for model families we know accept reasoning_effort."""
    if "api.openai.com" not in base_url:
        return False

    openai_reasoning_prefixes = ("o1", "o3", "o4", "gpt-5")
    return model_name.startswith(openai_reasoning_prefixes)


def get_llm(max_tokens: int = 4096, model: str | None = None, reasoning_effort: str | None = None) -> ChatOpenAI:
    """Create a ChatOpenAI instance for the currently configured model."""
    model_name = model or settings.model_name
    base_url = settings.llm_base_url_for(model_name)
    api_key = settings.llm_api_key_for(model_name)

    extra_body = None
    if reasoning_effort and _supports_reasoning_effort(model_name, base_url):
        extra_body = {"reasoning_effort": reasoning_effort}
    elif reasoning_effort:
        logger.info(
            "Skipping reasoning_effort=%s for model=%s base_url=%s",
            reasoning_effort,
            model_name,
            base_url,
        )

    return ChatOpenAI(
        model=model_name,
        api_key=api_key,
        base_url=base_url,
        max_tokens=max_tokens,  # pyright: ignore[reportCallIssue]
        extra_body=extra_body,  # pyright: ignore[reportCallIssue]
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
    logger.info("LLM structured call → %s  (prompt %d chars)", response_model.__name__, len(prompt))
    structured_llm = llm.with_structured_output(response_model)
    result = await structured_llm.ainvoke(prompt)
    logger.info("LLM structured call ← %s  OK", response_model.__name__)
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
