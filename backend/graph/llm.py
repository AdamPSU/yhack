"""Shared LLM client factory using K2-Think-v2."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, TypeVar

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from config import K2_API_KEY, K2_BASE_URL, K2_MODEL

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


def get_llm(max_tokens: int | None = None, **_kwargs: Any) -> ChatOpenAI:
    """Create a ChatOpenAI instance pointed at K2-Think-v2."""
    kwargs: dict[str, Any] = {"model": K2_MODEL, "api_key": K2_API_KEY, "base_url": K2_BASE_URL}
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    return ChatOpenAI(**kwargs)  # pyright: ignore[reportCallIssue]


def _extract_json_from_response(content: str) -> Any:
    """Extract and parse JSON from LLM response (strips <think> tags and markdown fences).

    Returns the parsed Python object, or raises json.JSONDecodeError if nothing found.
    """
    original = content
    # K2 sometimes omits the opening <think> tag, outputting reasoning directly up to </think>
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
    content = re.sub(r"^.*?</think>", "", content, flags=re.DOTALL)

    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if json_match:
        fence_content = json_match.group(1).strip()
        if fence_content:
            return json.loads(fence_content)

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

    def _scan(text: str) -> list[tuple[int, Any]]:
        results: list[tuple[int, Any]] = []
        for i, ch in enumerate(text):
            if ch not in "[{":
                continue
            candidate = _balanced_json_slice(text, i)
            if not candidate:
                continue
            try:
                results.append((i, json.loads(candidate)))
            except json.JSONDecodeError:
                continue
        return results

    content = content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Scan right-to-left: K2 outputs reasoning first, actual JSON last.
    candidates = _scan(content)

    # K2 sometimes embeds JSON inside <think> blocks — fall back to scanning original.
    if not candidates:
        candidates = _scan(original)

    if candidates:
        # Prefer largest dict by serialized size (catches container dicts with list values
        # over small inner dicts that happen to have more keys)
        dicts = [v for _, v in candidates if isinstance(v, dict) and v]
        if dicts:
            return max(dicts, key=lambda d: len(json.dumps(d)))
        return candidates[-1][1]

    raise json.JSONDecodeError("No JSON found", content, 0)


def _unwrap_k2_array(parsed: Any) -> Any:
    """K2 sometimes wraps a single object in an array — return the first dict found."""
    if isinstance(parsed, list):
        return next((x for x in parsed if isinstance(x, dict)), {})
    return parsed


async def invoke_llm_structured(
    prompt: str,
    response_model: type[T],
    max_tokens: int = 4096,
    llm: ChatOpenAI | None = None,
    **_kwargs: Any,
) -> T:
    """Invoke K2 and parse the response into a Pydantic model."""
    if llm is None:
        llm = get_llm(max_tokens=max_tokens)

    logger.info(
        "LLM structured call → %s (prompt %d chars)",
        response_model.__name__,
        len(prompt),
    )

    response = await llm.ainvoke(prompt)
    content: str = response.content  # pyright: ignore[reportAssignmentType]

    try:
        parsed = _unwrap_k2_array(_extract_json_from_response(content))
        result = response_model.model_validate(parsed)
        logger.info("LLM structured call ← %s OK", response_model.__name__)
        return result
    except Exception as e:
        logger.warning(
            "Failed to parse response for %s: %s\nContent: %s",
            response_model.__name__,
            e,
            content[:500],
        )
        raise


async def invoke_llm_json(
    prompt: str,
    max_tokens: int = 4096,
    llm: ChatOpenAI | None = None,
    **_kwargs: Any,
) -> dict[str, Any]:
    """Invoke K2 and return the parsed JSON response as a dict."""
    if llm is None:
        llm = get_llm(max_tokens=max_tokens)

    response = await llm.ainvoke(prompt)
    content: str = response.content  # pyright: ignore[reportAssignmentType]

    return _unwrap_k2_array(_extract_json_from_response(content))
