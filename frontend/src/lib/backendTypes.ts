// TypeScript interfaces mirroring backend Pydantic models

export type BackendRole =
  | "worker"
  | "business_owner"
  | "politician"
  | "student"
  | "retiree"
  | "activist"
  | "farmer"
  | "shopkeeper";

export type BackendMood =
  | "angry"
  | "anxious"
  | "worried"
  | "neutral"
  | "hopeful"
  | "excited";

export type BackendEventType =
  | "chat"
  | "move"
  | "protest"
  | "price_change"
  | "mood_shift";

export type BackendRelType =
  | "friend"
  | "family"
  | "employer"
  | "neighbor"
  | "colleague";

export interface BackendNPC {
  id: string;
  name: string;
  role: BackendRole;
  income_level: "low" | "medium" | "high";
  political_leaning: number; // -1 to 1
  industry: string;
  personality: string;
  x: number; // 0..19
  y: number; // 0..14
  mood: BackendMood;
}

export interface BackendSimEvent {
  round: number;
  npc_id: string;
  event_type: BackendEventType;
  message: string;
  data: Record<string, unknown>;
}

export interface BackendRelationship {
  source_id: string;
  target_id: string;
  rel_type: BackendRelType;
  strength: number; // 0-1
}

export interface StakeholderInfo {
  name: string;
  type: "individual" | "group" | "institution";
  impact: string;
}

export interface EconomicImpact {
  description: string;
  direction: "positive" | "negative";
  magnitude: "low" | "medium" | "high";
  timeframe: "immediate" | "short-term" | "long-term";
}

export interface BackendPolicyAnalysis {
  sectors: string[];
  stakeholders: StakeholderInfo[];
  economic_impacts: EconomicImpact[];
  controversy_level: "low" | "medium" | "high";
}

// Discriminated union for all WebSocket message types

export interface WSPolicyAnalysisMsg {
  type: "policy_analysis";
  entities: BackendPolicyAnalysis[];
}

export interface WSInitMsg {
  type: "init";
  npcs: BackendNPC[];
  relationships: BackendRelationship[];
}

export interface WSRoundMsg {
  type: "round";
  round: number;
  events: BackendSimEvent[];
  npcs: BackendNPC[];
}

export interface WSDoneMsg {
  type: "done";
}

export interface WSErrorMsg {
  type: "error";
  message: string;
}

export type WSMessage =
  | WSPolicyAnalysisMsg
  | WSInitMsg
  | WSRoundMsg
  | WSDoneMsg
  | WSErrorMsg;
