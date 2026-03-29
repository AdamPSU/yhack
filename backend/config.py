"""Application configuration with modular LLM provider support."""

from enum import Enum
from typing import Any

from pydantic_settings import BaseSettings

# Grid dimensions used across the simulation (pixel-art world size).
GRID_WIDTH = 20
GRID_HEIGHT = 15
MAX_X = GRID_WIDTH - 1  # 19
MAX_Y = GRID_HEIGHT - 1  # 14

MAX_NPCS = 25

# Simulation timeline: 3 phases × 5 rounds each = 15 total rounds.
NUM_PHASES = 3
ROUNDS_PER_PHASE = 5
DEFAULT_NUM_ROUNDS = NUM_PHASES * ROUNDS_PER_PHASE

# Memory stream parameters (adapted from Park et al. 2023, arXiv:2304.03442).
MEMORY_TOP_K = 8
RECENCY_DECAY = 0.8  # Per round; paper uses 0.995/hour over multi-day sims.
REFLECTION_THRESHOLD = 25  # Sum of recent importance scores that triggers reflection.
REFLECTION_MAX_PER_ROUND = 5  # Cap concurrent reflection LLM calls per round.


class Provider(str, Enum):
    """Supported LLM providers."""

    XAI = "xai"
    K2 = "k2"
    GEMINI = "gemini"


# Provider configuration registry
# Each provider defines: base_url, api_key_env, models per tier, and feature support
PROVIDER_CONFIG: dict[Provider, dict[str, Any]] = {
    Provider.XAI: {
        "base_url": "https://api.x.ai/v1",
        "api_key_env": "xai_api_key",
        "default_model": "grok-4.20-non-reasoning",
        "fast_model": "grok-4-1-fast-non-reasoning",
        "reasoning_model": "grok-4-1-fast-reasoning",
        "supports_structured_output": True,
        "supports_reasoning_effort": False,
    },
    Provider.K2: {
        "base_url": "https://api.k2think.ai/v1",
        "api_key_env": "k2_api_key",
        "default_model": "MBZUAI-IFM/K2-Think-v2",
        "fast_model": "MBZUAI-IFM/K2-Think-v2",
        "reasoning_model": "MBZUAI-IFM/K2-Think-v2",
        "supports_structured_output": False,  # Falls back to JSON parsing
        "supports_reasoning_effort": False,
    },
    Provider.GEMINI: {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "api_key_env": "gemini_api_key",
        "default_model": "gemini-3.0-flash",
        "fast_model": "gemini-3.0-flash",
        "reasoning_model": "gemini-3.0-flash",
        "supports_structured_output": True,
        "supports_reasoning_effort": False,
    },
}


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Keys (only the active provider's key is required)
    xai_api_key: str = ""
    k2_api_key: str = ""
    gemini_api_key: str = ""

    # Active provider (set via PROVIDER env var)
    provider: Provider = Provider.XAI

    model_config: dict[str, Any] = {
        "env_file": (".env", ".env.local"),
    }  # pyright: ignore[reportIncompatibleVariableOverride]

    @property
    def provider_config(self) -> dict[str, Any]:
        """Get configuration for the active provider."""
        return PROVIDER_CONFIG[self.provider]

    @property
    def base_url(self) -> str:
        """Get the API base URL for the active provider."""
        return self.provider_config["base_url"]

    @property
    def api_key(self) -> str:
        """Get the API key for the active provider."""
        env_var = self.provider_config["api_key_env"]
        return getattr(self, env_var)

    def get_model(self, tier: str = "default") -> str:
        """Get model name for the specified tier.

        Args:
            tier: One of "default", "fast", or "reasoning"

        Returns:
            Provider-default model for the requested tier
        """
        if tier not in {"default", "fast", "reasoning"}:
            raise ValueError(f"Unsupported model tier: {tier}")
        return self.provider_config[f"{tier}_model"]

    @property
    def supports_structured_output(self) -> bool:
        """Check if the active provider supports native structured output."""
        return self.provider_config["supports_structured_output"]

    @property
    def supports_reasoning_effort(self) -> bool:
        """Check if the active provider supports reasoning_effort parameter."""
        return self.provider_config["supports_reasoning_effort"]

    # Backwards compatibility properties
    @property
    def llm_api_key(self) -> str:
        """Backwards compatible alias for api_key."""
        return self.api_key

    @property
    def llm_base_url(self) -> str:
        """Backwards compatible alias for base_url."""
        return self.base_url


settings = Settings()
