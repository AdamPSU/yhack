// Shared types for AGORA frontend

export type SimEventType =
  | "reaction"
  | "price_change"
  | "layoff"
  | "protest"
  | "closure"
  | "strike"
  | "policy_response"
  | "phase_change";

export interface SimEvent {
  id: string;
  type: SimEventType;
  agentId: string;
  agentName: string;
  message: string;
  phase: number; // 1-3
  month: number; // 1-9
  metrics?: Partial<SimMetrics>;
  timestamp: number;
}

export interface SimMetrics {
  priceIndex: number; // % change from baseline
  unemploymentRate: number; // %
  socialUnrest: number; // 0-1
  businessSurvival: number; // 0-1
  govApproval: number; // 0-1
  interestRate: number; // %
}

export interface NPCState {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: "up" | "down" | "left" | "right";
  state: "idle" | "walking" | "protesting";
  message?: string;
}

export interface BuildingPositions {
  government: { x: number; y: number };
  shops: { id: string; x: number; y: number }[];
  factories: { id: string; x: number; y: number }[];
  houses: { id: string; x: number; y: number }[];
}
