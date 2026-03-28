"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adaptEvent, roundToPhase } from "@/lib/adapter";
import type { BackendNPC, WSRoundMsg } from "@/lib/backendTypes";
import {
  createAccumulator,
  type MetricsAccumulator,
  updateMetrics,
} from "@/lib/metricsEngine";
import type { SimEvent, SimMetrics } from "@/lib/types";
import { connectWebSocket, startSimulation } from "@/lib/wsClient";

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

export function useSimulation(policyText?: string) {
  const [state, setState] = useState<SimulationState>({
    events: [],
    metrics: { ...INITIAL_METRICS },
    phase: 0,
    month: 0,
    isRunning: false,
    isComplete: false,
    latestEvent: null,
  });

  const cleanupRef = useRef<(() => void) | null>(null);
  const npcLookupRef = useRef<Map<string, BackendNPC>>(new Map());
  const metricsAccRef = useRef<MetricsAccumulator>(createAccumulator());
  const eventQueueRef = useRef<SimEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRoundsRef = useRef(75);
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
    metricsAccRef.current = createAccumulator();
    eventQueueRef.current = [];
    lastPhaseRef.current = 0;

    const text = policyText || "";
    if (!text) return;

    try {
      const simId = await startSimulation(text);

      const cleanup = connectWebSocket(simId, {
        onPolicyAnalysis: () => {},

        onInit: (msg) => {
          const lookup = npcLookupRef.current;
          for (const npc of msg.npcs) {
            lookup.set(npc.id, npc);
          }

          getBridge().then(({ eventBridge }) => {
            eventBridge.emitInitNPCs(msg.npcs);
          });
        },

        onRound: (msg: WSRoundMsg) => {
          const round = msg.round;
          const lookup = npcLookupRef.current;
          for (const npc of msg.npcs) {
            lookup.set(npc.id, npc);
          }

          // Inject phase_change event at phase boundaries
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

          // Forward move/mood events directly to Phaser (not queued for EventFeed)
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

          // Adapt non-move events for the EventFeed queue
          for (const be of msg.events) {
            const adapted = adaptEvent(be, lookup, round, maxRoundsRef.current);
            if (adapted) {
              eventQueueRef.current.push(adapted);
            }
          }

          // Incremental metrics update (only scans this round's events)
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

        onDone: () => {
          // Wait for event queue to drain, then mark complete (max 5min safety)
          let checks = 0;
          const checkDone = () => {
            if (eventQueueRef.current.length === 0 || ++checks > 300) {
              setState((prev) => ({
                ...prev,
                isRunning: false,
                isComplete: true,
              }));
            } else {
              setTimeout(checkDone, 1000);
            }
          };
          checkDone();
        },

        onError: (message) => {
          console.error("Simulation error:", message);
          setState((prev) => ({ ...prev, isRunning: false }));
        },
      });

      cleanupRef.current = cleanup;
    } catch (err) {
      console.error("Failed to start simulation:", err);
      setState((prev) => ({ ...prev, isRunning: false }));
    }
  }, [policyText, drainQueue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cleanupRef.current?.();
    };
  }, []);

  return {
    ...state,
    start,
  };
}
