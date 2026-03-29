from typing import Any, Literal

from pydantic import BaseModel, Field

from config import MAX_X, MAX_Y

# Canonical mood values used throughout the simulation.
MoodLiteral = Literal["angry", "anxious", "worried", "neutral", "hopeful", "excited"]


class NPC(BaseModel):
    id: str
    name: str
    category: str = ""
    role: Literal[
        "worker",
        "business_owner",
        "politician",
        "student",
        "retiree",
        "activist",
        "farmer",
        "shopkeeper",
        "driver",
    ] = "worker"
    gender: str
    bio: str
    persona: str
    mbti: str
    country: str
    profession: str
    interested_topics: list[str]
    income_level: Literal["low", "medium", "high"]
    political_leaning: float = Field(ge=-1, le=1)
    reputation: float = Field(default=0.5, ge=0, le=1)
    beliefs: list[str] = Field(default_factory=list)
    controversial_ideas: list[str] = Field(default_factory=list)
    x: int = Field(ge=0, le=MAX_X)
    y: int = Field(ge=0, le=MAX_Y)


class Relationship(BaseModel):
    source_id: str
    target_id: str
    affinity: float = Field(default=0.0, ge=-1, le=1)
    trust: float = Field(default=0.5, ge=0, le=1)


class SimEvent(BaseModel):
    round: int
    npc_id: str
    event_type: Literal["chat", "move", "protest", "price_change", "mood_shift"]
    message: str
    data: dict[str, Any] = Field(default_factory=dict)


SourceKind = Literal["pdf", "csv"]
SourceStatus = Literal["ready"]
TrendDirection = Literal["up", "down", "flat", "unknown"]
ReportDirection = Literal["positive", "negative", "mixed"]
ReportSeverity = Literal["low", "medium", "high"]
ReportTrend = Literal["up", "down", "flat", "mixed"]


class IndicatorSnapshot(BaseModel):
    metric: str
    latest_value: float
    previous_value: float | None = None
    change: float | None = None
    trend: TrendDirection = "unknown"
    latest_period: str | None = None
    source_id: str
    unit: str | None = None


class ContextSourceResponse(BaseModel):
    id: str
    kind: SourceKind
    filename: str
    label: str
    status: SourceStatus = "ready"
    preview_text: str = ""
    summary: str = ""
    metadata: dict[str, Any] = Field(default_factory=dict)


class PolicyContextBundle(BaseModel):
    policy_text: str
    notes_text: str = ""
    trend_summary: str = ""
    source_summaries: list[str] = Field(default_factory=list)
    indicator_snapshots: list[IndicatorSnapshot] = Field(default_factory=list)


class PolicyInput(BaseModel):
    primary_policy_source_id: str
    notes_text: str = Field(default="", max_length=4000)
    trend_source_ids: list[str] = Field(default_factory=list)
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
    is_controversial: bool = Field(default=False, description="Whether this action expresses a highly controversial or polarizing idea.")
    data: dict[str, Any] = Field(default_factory=dict)


MemType = Literal["observation", "reflection", "plan"]


class NPCRoundResponseV2(BaseModel):
    """Extended response capturing internal reasoning for memory creation.

    Based on the generative agents architecture (Park et al., 2023).
    """

    perception: str = Field(
        description="What you notice about the situation, your emotional reaction to it, and your social strategy for how you will interact with others this round."
    )
    plan_update: str | None = None
    events: list[RawNPCEvent]


class ReflectionResponse(BaseModel):
    """Structured response from an NPC's reflection phase."""

    insights: list[str]


class ReportImpact(BaseModel):
    title: str
    description: str
    direction: ReportDirection
    severity: ReportSeverity


class ReportStat(BaseModel):
    label: str
    value: str
    trend: ReportTrend | None = None


class ChartSlice(BaseModel):
    label: str
    value: int = Field(ge=0)


class BarChartEntry(BaseModel):
    label: str
    value: int = Field(ge=0)


class PieChartData(BaseModel):
    title: str
    slices: list[ChartSlice]


class BarChartData(BaseModel):
    title: str
    bars: list[BarChartEntry]


class EconomicReportNarrative(BaseModel):
    headline: str
    summary: str
    livelihood_impact: str
    top_impacts: list[ReportImpact]
    notable_events: list[str]


class EconomicReportResponse(BaseModel):
    headline: str
    summary: str
    livelihood_impact: str
    top_impacts: list[ReportImpact]
    key_stats: list[ReportStat]
    pie_chart: PieChartData
    bar_chart: BarChartData
    notable_events: list[str]
