from pydantic_settings import BaseSettings

# Grid dimensions used across the simulation (pixel-art world size).
GRID_WIDTH = 20
GRID_HEIGHT = 15
MAX_X = GRID_WIDTH - 1  # 19
MAX_Y = GRID_HEIGHT - 1  # 14

MAX_NPCS = 25


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
