from typing import Any, Literal

from pydantic import BaseModel, Field

from config import MAX_X, MAX_Y

# Canonical mood values used throughout the simulation.
MoodLiteral = Literal["angry", "anxious", "worried", "neutral", "hopeful", "excited"]


class NPC(BaseModel):
    id: str
    name: str
    gender: str
    bio: str
    persona: str
    mbti: str
    country: str
    profession: str
    interested_topics: list[str]
    income_level: Literal["low", "medium", "high"]
    political_leaning: float = Field(ge=-1, le=1)
    x: int = Field(ge=0, le=MAX_X)
    y: int = Field(ge=0, le=MAX_Y)


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
    data: dict[str, Any] = Field(default_factory=dict)


class PolicyInput(BaseModel):
    text: str = Field(max_length=10000)
    num_rounds: int = 75
    num_npcs: int = 25
    objective: str = Field(default="", max_length=500)
    map_id: str = Field(default="ccity")


# --- Structured output response models for LLM calls ---


class StakeholderInfo(BaseModel):
    name: str
    type: Literal["individual", "group", "institution"]
    impact: str


class EconomicImpact(BaseModel):
    description: str
    direction: Literal["positive", "negative"]
    magnitude: Literal["low", "medium", "high"]
    timeframe: Literal["immediate", "short-term", "long-term"]


class PolicyAnalysis(BaseModel):
    """Structured response from the policy parsing LLM call."""
    sectors: list[str]
    stakeholders: list[StakeholderInfo]
    economic_impacts: list[EconomicImpact]
    controversy_level: Literal["low", "medium", "high"]


class NPCGenerationResponse(BaseModel):
    """Structured response from the NPC generation LLM call."""
    npcs: list[NPC]
    relationships: list[Relationship]


class RawNPCEvent(BaseModel):
    """A single event produced by an NPC during a simulation round."""
    event_type: Literal["chat", "move", "protest", "price_change", "mood_shift"]
    message: str
    data: dict[str, Any] = Field(default_factory=dict)


MemType = Literal["observation", "reflection", "plan"]


class NPCRoundResponseV2(BaseModel):
    """Extended response capturing internal reasoning for memory creation.

    Based on the generative agents architecture (Park et al., 2023).
    """
    perception: str
    emotional_reaction: str
    plan_update: str | None = None
    events: list[RawNPCEvent]


class ReflectionResponse(BaseModel):
    """Structured response from an NPC's reflection phase."""
    insights: list[str]
