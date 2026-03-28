"""Shared LLM client factory for graph nodes."""

from langchain_anthropic import ChatAnthropic

from config import settings


def get_llm(max_tokens: int = 4096) -> ChatAnthropic:
    """Create a ChatAnthropic instance with project-wide settings."""
    return ChatAnthropic(
        model=settings.model_name,
        api_key=settings.anthropic_api_key,
        max_tokens=max_tokens,
    )
