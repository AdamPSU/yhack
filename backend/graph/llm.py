"""Shared LLM client factory for graph nodes with modular provider support."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, TypeVar

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def get_llm(
    max_tokens: int = 4096,
    tier: str = "default",
    model: str | None = None,
) -> ChatOpenAI:
    """Create a ChatOpenAI instance for the active provider.

    Args:
        max_tokens: Maximum tokens for the response
        tier: Model tier - "default", "fast", or "reasoning"
        model: Optional explicit model override (ignores tier)

    Returns:
        Configured ChatOpenAI instance
    """
    model_name = model or settings.get_model(tier)

    logger.debug(
        "Creating LLM: provider=%s tier=%s model=%s",
        settings.provider.value,
        tier,
        model_name,
    )

    return ChatOpenAI(
        model=model_name,
        api_key=settings.api_key,
        base_url=settings.base_url,
        max_tokens=max_tokens,  # pyright: ignore[reportCallIssue]
    )


def _extract_json_from_response(content: str) -> str:
    """Extract JSON from LLM response that may contain markdown or thinking tags.

    Handles:
    - ```json ... ``` code blocks
    - <think>...</think> tags (K2 reasoning)
    - Raw JSON
    """
    # Remove <think>...</think> blocks (K2 reasoning output)
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)

    # Try to extract from ```json code block
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if json_match:
        return json_match.group(1).strip()

    def _balanced_json_slice(text: str, start: int) -> str | None:
        open_char = text[start]
        if open_char not in "[{":
            return None

        close_char = "}" if open_char == "{" else "]"
        stack: list[str] = [close_char]
        in_string = False
        escaped = False

        for i in range(start + 1, len(text)):
            ch = text[i]

            if in_string:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == '"':
                    in_string = False
                continue

            if ch == '"':
                in_string = True
                continue

            if ch == "{":
                stack.append("}")
            elif ch == "[":
                stack.append("]")
            elif ch in "]}":
                if not stack or ch != stack[-1]:
                    return None
                stack.pop()
                if not stack:
                    return text[start : i + 1]

        return None

    content = content.strip()

    # Try exact JSON first.
    try:
        json.loads(content)
        return content
    except json.JSONDecodeError:
        pass

    # Try scanning for first valid JSON object/array anywhere in the text.
    for i, ch in enumerate(content):
        if ch not in "[{":
            continue
        candidate = _balanced_json_slice(content, i)
        if not candidate:
            continue
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            continue

    return content


async def invoke_llm_structured(
    prompt: str,
    response_model: type[T],
    max_tokens: int = 4096,
    llm: ChatOpenAI | None = None,
    tier: str = "default",
) -> T:
    """Invoke the LLM with Pydantic structured output.

    Uses native structured output for providers that support it,
    falls back to JSON-in-prompt for others (e.g., K2).

    Args:
        prompt: The prompt to send
        response_model: Pydantic model for the expected response
        max_tokens: Maximum tokens for the response
        llm: Optional pre-configured LLM instance
        tier: Model tier if llm not provided

    Returns:
        Parsed response matching response_model
    """
    if llm is None:
        llm = get_llm(max_tokens=max_tokens, tier=tier)

    logger.info(
        "LLM structured call → %s (prompt %d chars, provider=%s)",
        response_model.__name__,
        len(prompt),
        settings.provider.value,
    )

    if settings.supports_structured_output:
        # Provider supports native structured output (OpenAI, xAI, Gemini)
        structured_llm = llm.with_structured_output(response_model)
        result = await structured_llm.ainvoke(prompt)
        logger.info("LLM structured call ← %s OK", response_model.__name__)
        return result  # type: ignore[return-value]
    else:
        # Fallback: inject schema into prompt, parse JSON response (K2)
        schema = response_model.model_json_schema()
        prompt_with_schema = (
            f"{prompt}\n\n"
            f"IMPORTANT: Respond with ONLY valid JSON (no markdown, no explanation) "
            f"matching this schema:\n```json\n{json.dumps(schema, indent=2)}\n```"
        )

        response = await llm.ainvoke(prompt_with_schema)
        content: str = response.content  # pyright: ignore[reportAssignmentType]

        # Extract and parse JSON
        json_str = _extract_json_from_response(content)
        try:
            result = response_model.model_validate_json(json_str)
            logger.info(
                "LLM structured call ← %s OK (JSON fallback)", response_model.__name__
            )
            return result
        except Exception as e:
            logger.warning(
                "Failed to parse JSON response for %s: %s\nContent: %s",
                response_model.__name__,
                e,
                content[:500],
            )
            raise


async def invoke_llm_json(
    prompt: str,
    max_tokens: int = 4096,
    fallback: dict[str, Any] | None = None,
    llm: ChatOpenAI | None = None,
    tier: str = "default",
) -> dict[str, Any]:
    """Invoke the LLM and parse the JSON response.

    Fallback path for when structured output is not suitable.

    Args:
        prompt: The prompt to send
        max_tokens: Maximum tokens for the response
        fallback: Default value if parsing fails
        llm: Optional pre-configured LLM instance
        tier: Model tier if llm not provided

    Returns:
        Parsed JSON as dict
    """
    if llm is None:
        llm = get_llm(max_tokens=max_tokens, tier=tier)

    response = await llm.ainvoke(prompt)
    content: str = response.content  # pyright: ignore[reportAssignmentType]

    json_str = _extract_json_from_response(content)
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse JSON: %s\nContent: %s", e, content[:500])
        if fallback is not None:
            return fallback
        raise
