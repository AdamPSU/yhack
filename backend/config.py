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


class Settings(BaseSettings):
    xai_api_key: str = ""
    k2_api_key: str = ""
    model_name: str = "grok-4.20"

    model_config: dict[str, tuple[str, str]] = {"env_file": (".env", ".env.local")}  # pyright: ignore[reportIncompatibleVariableOverride]

    @property
    def _is_k2_model(self) -> bool:
        return self.model_name.startswith("k2")

    @property
    def llm_api_key(self) -> str:
        """Return the API key for the currently selected model."""
        return self.k2_api_key if self._is_k2_model else self.xai_api_key

    @property
    def llm_base_url(self) -> str:
        """Return the base URL for the currently selected model."""
        if self._is_k2_model:
            return "https://api.k2think.ai/v1"
        return "https://api.x.ai/v1"


settings = Settings()
