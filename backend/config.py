from pydantic_settings import BaseSettings

# Grid dimensions used across the simulation (pixel-art world size).
GRID_WIDTH = 20
GRID_HEIGHT = 15
MAX_X = GRID_WIDTH - 1   # 19
MAX_Y = GRID_HEIGHT - 1  # 14

MAX_NPCS = 25


class Settings(BaseSettings):
    xai_api_key: str = ""
    k2_api_key: str = ""
    model_name: str = "grok-3-think-v2"
    max_rounds: int = 5

    model_config = {"env_file": ".env"}

    @property
    def llm_api_key(self) -> str:
        """Return the API key for the currently selected model."""
        if self.model_name.startswith("k2"):
            return self.k2_api_key
        return self.xai_api_key

    @property
    def llm_base_url(self) -> str:
        """Return the base URL for the currently selected model."""
        if self.model_name.startswith("k2"):
            return "https://api.k2think.ai/v1"
        return "https://api.x.ai/v1"


settings = Settings()
