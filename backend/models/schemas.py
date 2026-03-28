from typing import Literal

from pydantic import BaseModel, Field

from config import MAX_X, MAX_Y


class NPC(BaseModel):
    id: str
    name: str
    role: Literal[
        "worker",
        "business_owner",
        "politician",
        "student",
        "retiree",
        "activist",
        "farmer",
        "shopkeeper",
    ]
    income_level: Literal["low", "medium", "high"]
    political_leaning: float = Field(ge=-1, le=1)
    industry: str
    personality: str
    x: int = Field(ge=0, le=MAX_X)
    y: int = Field(ge=0, le=MAX_Y)
    mood: str = "neutral"


class Relationship(BaseModel):
    source_id: str
    target_id: str
    rel_type: Literal["friend", "family", "employer", "neighbor", "colleague"]
    strength: float = Field(default=0.5, ge=0, le=1)


class SimEvent(BaseModel):
    round: int
    npc_id: str
    event_type: Literal["chat", "move", "protest", "price_change", "mood_shift"]
    message: str
    data: dict = Field(default_factory=dict)


class PolicyInput(BaseModel):
    text: str = Field(max_length=3000)
    num_rounds: int = 5
