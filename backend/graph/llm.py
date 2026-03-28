"""Shared LLM client factory for graph nodes."""

from langchain_openai import ChatOpenAI

from config import settings


def get_llm(max_tokens: int = 4096) -> ChatOpenAI:
    """Create a ChatOpenAI instance for the currently configured model."""
    return ChatOpenAI(
        model=settings.model_name,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
        max_tokens=max_tokens,
    )
