from pydantic_settings import BaseSettings

# Grid dimensions used across the simulation (pixel-art world size).
GRID_WIDTH = 20
GRID_HEIGHT = 15
MAX_X = GRID_WIDTH - 1   # 19
MAX_Y = GRID_HEIGHT - 1  # 14

MAX_NPCS = 25


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    model_name: str = "claude-sonnet-4-20250514"
    max_rounds: int = 5

    model_config = {"env_file": ".env"}


settings = Settings()
