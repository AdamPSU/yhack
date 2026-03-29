"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adaptEvent, roundToPhase } from "@/lib/adapter";
import {
  createAccumulator,
  type MetricsAccumulator,
  updateMetrics,
} from "@/lib/metricsEngine";
import { generateMockSimulation } from "@/mocks/mockBackend";
import { connectSimulation } from "@/services/wsClient";
import type { SimEvent, SimMetrics } from "@/types";
import type {
  BackendInfluenceEvent,
  BackendNPC,
  BackendRelationship,
  BackendSimEvent,
  WSNPCEventsMsg,
  WSRoundMsg,
} from "@/types/backend";

export interface GraphData {
  relationships: BackendRelationship[];
  npcs: BackendNPC[];
  influenceEvents: BackendInfluenceEvent[];
  version: number;
}

const USE_MOCK = process.env.NEXT_PUBLIC_MOCK_BACKEND === "true";

const INITIAL_METRICS: SimMetrics = {
  priceIndex: 0,
  unemploymentRate: 4.2,
  socialUnrest: 0.05,
  businessSurvival: 0.95,
  govApproval: 0.62,
  interestRate: 5.25,
};

const PHASE_LABELS: Record<number, string> = {
  1: "Phase 1: Policy Announcement & Initial Assessment",
  2: "Phase 2: Economic Ripple Effects",
  3: "Phase 3: Social Crisis & Reckoning",
};

/** Cap EventFeed to last N events to avoid unbounded React state growth */
const MAX_FEED_EVENTS = 200;

interface SimulationState {
  events: SimEvent[];
  metrics: SimMetrics;
  phase: number;
  month: number;
  isRunning: boolean;
  isComplete: boolean;
  latestEvent: SimEvent | null;
}

// Cache EventBridge module to avoid per-event dynamic import overhead
let bridgePromise: Promise<typeof import("@/game/bridge/EventBridge")> | null =
  null;
function getBridge() {
  if (!bridgePromise) {
    bridgePromise = import("@/game/bridge/EventBridge");
  }
  return bridgePromise;
}

function waitForQueueDrain(
  queueRef: React.RefObject<SimEvent[]>,
  setDone: React.Dispatch<React.SetStateAction<SimulationState>>,
) {
  let checks = 0;
  const tick = () => {
    if (queueRef.current.length === 0 || ++checks > 300) {
      setDone((prev) => ({ ...prev, isRunning: false, isComplete: true }));
    } else {
      setTimeout(tick, 1000);
    }
  };
  tick();
}

export function useSimulation(simulationId?: string) {
  const [state, setState] = useState<SimulationState>({
    events: [],
    metrics: { ...INITIAL_METRICS },
    phase: 0,
    month: 0,
    isRunning: false,
    isComplete: false,
    latestEvent: null,
  });

  const [graphData, setGraphData] = useState<GraphData>({
    relationships: [],
    npcs: [],
    influenceEvents: [],
    version: 0,
  });

  const cleanupRef = useRef<(() => void) | null>(null);
  const npcLookupRef = useRef<Map<string, BackendNPC>>(new Map());
  const relationshipsRef = useRef<BackendRelationship[]>([]);
  const influenceLogRef = useRef<BackendInfluenceEvent[]>([]);
  const metricsAccRef = useRef<MetricsAccumulator>(createAccumulator());
  const eventQueueRef = useRef<SimEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRoundsRef = useRef(15);
  const lastPhaseRef = useRef(0);

  const drainQueue = useCallback(() => {
    const queue = eventQueueRef.current;
    if (queue.length === 0) {
      timerRef.current = null;
      return;
    }

    const event = queue.shift();
    if (!event) return;

    getBridge().then(({ eventBridge }) => {
      if (event.type === "phase_change") {
        eventBridge.emitPhaseChange(event.phase, event.month);
      }
      eventBridge.emitSimEvent(event);
    });

    setState((prev) => {
      const events =
        prev.events.length >= MAX_FEED_EVENTS
          ? [...prev.events.slice(-MAX_FEED_EVENTS + 1), event]
          : [...prev.events, event];
      return {
        ...prev,
        events,
        latestEvent: event,
        phase: event.phase > prev.phase ? event.phase : prev.phase,
        month: event.month > prev.month ? event.month : prev.month,
      };
    });

    const delay =
      event.type === "phase_change" ? 2000 : 1200 + Math.random() * 600;
    timerRef.current = setTimeout(drainQueue, delay);
  }, []);

  /** Process streamed NPC events that arrive before the full round completes. */
  const processNPCEvents = useCallback(
    (msg: WSNPCEventsMsg) => {
      const lookup = npcLookupRef.current;

      getBridge().then(({ eventBridge }) => {
        for (const be of msg.events) {
          if (
            be.event_type === "move" &&
            be.data.to_x != null &&
            be.data.to_y != null
          ) {
            eventBridge.emitNPCMove(
              be.npc_id,
              Number(be.data.to_x),
              Number(be.data.to_y),
            );
          }
          if (be.event_type === "mood_shift" && be.data.new_mood) {
            eventBridge.emitNPCMood(be.npc_id, String(be.data.new_mood));
          }
        }
      });

      for (const be of msg.events) {
        const round = be.round ?? 0;
        const adapted = adaptEvent(be, lookup, round, maxRoundsRef.current);
        if (adapted) {
          eventQueueRef.current.push(adapted);
        }
      }

      if (!timerRef.current && eventQueueRef.current.length > 0) {
        timerRef.current = setTimeout(drainQueue, 300);
      }
    },
    [drainQueue],
  );

  /** Feed a single WSRoundMsg through the same pipeline as the real backend. */
  const processRound = useCallback(
    (msg: WSRoundMsg) => {
      const round = msg.round;
      const lookup = npcLookupRef.current;
      for (const npc of msg.npcs) {
        lookup.set(npc.id, npc);
      }

      const { phase, month } = roundToPhase(round, maxRoundsRef.current);
      if (phase > lastPhaseRef.current) {
        lastPhaseRef.current = phase;
        eventQueueRef.current.push({
          id: `phase-${phase}`,
          type: "phase_change",
          agentId: "system",
          agentName: "System",
          message: PHASE_LABELS[phase] || `Phase ${phase}`,
          phase,
          month,
          timestamp: Date.now(),
        });
      }

      getBridge().then(({ eventBridge }) => {
        for (const be of msg.events) {
          if (
            be.event_type === "move" &&
            be.data.to_x != null &&
            be.data.to_y != null
          ) {
            eventBridge.emitNPCMove(
              be.npc_id,
              Number(be.data.to_x),
              Number(be.data.to_y),
            );
          }
          if (be.event_type === "mood_shift" && be.data.new_mood) {
            eventBridge.emitNPCMood(be.npc_id, String(be.data.new_mood));
          }
        }
      });

      for (const be of msg.events) {
        const adapted = adaptEvent(be, lookup, round, maxRoundsRef.current);
        if (adapted) {
          eventQueueRef.current.push(adapted);
        }
      }

      if (msg.influence_events) {
        influenceLogRef.current = [
          ...influenceLogRef.current,
          ...msg.influence_events,
        ];
      }
      setGraphData((prev) => ({
        relationships: relationshipsRef.current,
        npcs: Array.from(npcLookupRef.current.values()),
        influenceEvents: msg.influence_events || [],
        version: prev.version + 1,
      }));

      const newMetrics = updateMetrics(
        metricsAccRef.current,
        msg.npcs,
        msg.events,
      );
      setState((prev) => ({
        ...prev,
        metrics: { ...prev.metrics, ...newMetrics },
      }));

      if (!timerRef.current && eventQueueRef.current.length > 0) {
        timerRef.current = setTimeout(drainQueue, 800);
      }
    },
    [drainQueue],
  );

  const start = useCallback(async () => {
    setState({
      events: [],
      metrics: { ...INITIAL_METRICS },
      phase: 0,
      month: 0,
      isRunning: true,
      isComplete: false,
      latestEvent: null,
    });
    npcLookupRef.current = new Map();
    relationshipsRef.current = [];
    influenceLogRef.current = [];
    metricsAccRef.current = createAccumulator();
    eventQueueRef.current = [];
    lastPhaseRef.current = 0;
    setGraphData({
      relationships: [],
      npcs: [],
      influenceEvents: [],
      version: 0,
    });

    // ── Mock backend path ──────────────────────────────────
    if (USE_MOCK) {
      const mock = generateMockSimulation(maxRoundsRef.current);
      const lookup = npcLookupRef.current;
      for (const npc of mock.initMsg.npcs) lookup.set(npc.id, npc);
      relationshipsRef.current = mock.initMsg.relationships;
      setGraphData((prev) => ({
        ...prev,
        relationships: mock.initMsg.relationships,
        npcs: mock.initMsg.npcs,
        version: prev.version + 1,
      }));
      getBridge().then(({ eventBridge }) => {
        eventBridge.emitInitNPCs(mock.initMsg.npcs);
      });
      let i = 0;
      const feedNext = () => {
        if (i >= mock.rounds.length) {
          waitForQueueDrain(eventQueueRef, setState);
          return;
        }
        processRound(mock.rounds[i++]);
        const t = setTimeout(feedNext, 150 + Math.random() * 100);
        cleanupRef.current = () => clearTimeout(t);
      };
      feedNext();
      return;
    }

    // ── Real backend path ──────────────────────────────────
    const simId = simulationId || "";
    if (!simId) {
      console.warn("[sim] no simulation ID — aborting");
      setState((prev) => ({ ...prev, isRunning: false }));
      return;
    }

    console.log("[sim] start() called — connecting WS for sim=%s", simId);

    try {
      const cleanup = connectSimulation(simId, {
        onPolicyAnalysis: (msg) => {
          console.log(
            "[sim] policy_analysis received — %d entities",
            msg.entities?.length ?? 0,
          );
        },

        onInit: (msg) => {
          console.log(
            "[sim] init received — %d NPCs, %d relationships",
            msg.npcs.length,
            msg.relationships.length,
          );
          const lookup = npcLookupRef.current;
          for (const npc of msg.npcs) {
            lookup.set(npc.id, npc);
          }
          relationshipsRef.current = msg.relationships;
          setGraphData((prev) => ({
            ...prev,
            relationships: msg.relationships,
            npcs: msg.npcs,
            version: prev.version + 1,
          }));

          getBridge().then(({ eventBridge }) => {
            eventBridge.emitInitNPCs(msg.npcs);
          });
        },

        onRound: (msg: WSRoundMsg) => {
          console.log(
            "[sim] round %d — %d events, %d NPCs",
            msg.round,
            msg.events.length,
            msg.npcs.length,
          );
          processRound(msg);
        },

        onNPCEvents: (msg) => {
          processNPCEvents(msg);
        },

        onDone: () => {
          console.log(
            "[sim] done — draining event queue (%d remaining)",
            eventQueueRef.current.length,
          );
          waitForQueueDrain(eventQueueRef, setState);
        },

        onError: (message) => {
          console.error("[sim] error:", message);
          setState((prev) => ({ ...prev, isRunning: false }));
        },
      });

      cleanupRef.current = cleanup;
    } catch (err) {
      console.error("Failed to start simulation:", err);
      setState((prev) => ({ ...prev, isRunning: false }));
    }
  }, [simulationId, processRound, processNPCEvents]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cleanupRef.current?.();
    };
  }, []);

  const getNpc = useCallback((id: string) => npcLookupRef.current.get(id), []);

  return {
    ...state,
    start,
    graphData,
    getNpc,
  };
}
