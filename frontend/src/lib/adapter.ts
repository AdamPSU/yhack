// Adapter layer: translates backend types to frontend SimEvent/SimEventType

import type { SimEvent, SimEventType } from "@/types";
import type { BackendNPC, BackendSimEvent } from "@/types/backend";
import { getMapConfig } from "@/game/constants";

export const LAYOFF_RE = /layoff|fired|let\s+go|cut.*jobs|furlough/i;
export const CLOSURE_RE =
  /clos(e|ing|ed)|shut.*down|going out of business|bankrupt/i;

// Factory tile locations on the Phaser map (approximate centers)
const FACTORY_ZONE = { xMin: 0, xMax: 8, yMin: 0, yMax: 6 };

function isAtFactory(x: number, y: number): boolean {
  const px = x * 2;
  const py = y * 2;
  return (
    px >= FACTORY_ZONE.xMin &&
    px <= FACTORY_ZONE.xMax &&
    py >= FACTORY_ZONE.yMin &&
    py <= FACTORY_ZONE.yMax
  );
}

/**
 * Map a backend event + NPC context to a frontend SimEventType.
 * Returns null for events that should be filtered out (e.g. move).
 */
export function classifyEventType(
  event: BackendSimEvent,
  npc: BackendNPC,
): SimEventType | null {
  switch (event.event_type) {
    case "move":
      return null;

    case "protest":
      if (npc.role === "worker" && isAtFactory(npc.x, npc.y)) {
        return "strike";
      }
      return "protest";

    case "price_change":
      return "price_change";

    case "chat":
      if (npc.role === "politician") return "policy_response";
      if (LAYOFF_RE.test(event.message)) return "layoff";
      if (CLOSURE_RE.test(event.message)) return "closure";
      return "reaction";

    case "mood_shift":
      return "reaction";

    default:
      return "reaction";
  }
}

/**
 * Map simulation round number to phase/month for the frontend timeline.
 * Each phase is ~25 rounds. Divides maxRounds into 3 equal thirds.
 * Months 1-9 are interpolated within each phase.
 */
export function roundToPhase(
  round: number,
  maxRounds: number,
): { phase: number; month: number } {
  const third = Math.max(1, Math.floor(maxRounds / 3));

  let phase: number;
  let phaseProgress: number;

  if (round < third) {
    phase = 1;
    phaseProgress = round / third;
  } else if (round < third * 2) {
    phase = 2;
    phaseProgress = (round - third) / third;
  } else {
    phase = 3;
    phaseProgress = Math.min(
      1,
      (round - third * 2) / Math.max(1, maxRounds - third * 2),
    );
  }

  // Each phase spans 3 months: P1=1-3, P2=4-6, P3=7-9
  const baseMonth = (phase - 1) * 3 + 1;
  const month = Math.min(
    baseMonth + 2,
    Math.floor(baseMonth + phaseProgress * 2),
  );

  return { phase, month };
}

/**
 * Fully translate a backend event into a frontend SimEvent.
 * Returns null for events that should be filtered (move events).
 */
export function adaptEvent(
  backendEvent: BackendSimEvent,
  npcLookup: Map<string, BackendNPC>,
  round: number,
  maxRounds: number,
): SimEvent | null {
  const npc = npcLookup.get(backendEvent.npc_id);
  if (!npc) return null;

  const eventType = classifyEventType(backendEvent, npc);
  if (eventType === null) return null;

  const { phase, month } = roundToPhase(round, maxRounds);

  return {
    id: `${backendEvent.npc_id}-${round}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: eventType,
    agentId: backendEvent.npc_id,
    agentName: npc.name,
    message: backendEvent.message,
    phase,
    month,
    timestamp: Date.now(),
  };
}

/** Get scaling factor from backend 20x15 grid to current Phaser map dimensions */
export function getCoordScale(): number {
  const mc = getMapConfig();
  // Map 20 logical units to map width (cols).
  // ccity: 80/20=4, citypack: 100/20=5, pico8: 55/20=2.75
  return Math.floor(mc.cols / 20);
}

export function moodToSentiment(
  mood: string,
): "happy" | "neutral" | "worried" | "angry" {
  switch (mood) {
    case "angry":
      return "angry";
    case "anxious":
    case "worried":
      return "worried";
    case "hopeful":
    case "excited":
      return "happy";
    default:
      return "neutral";
  }
}
