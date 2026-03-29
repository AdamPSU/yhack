"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adaptEvent, roundToPhase } from "@/lib/adapter";
import {
  createAccumulator,
  type MetricsAccumulator,
  updateMetrics,
} from "@/lib/metricsEngine";
import { generateMockSimulation } from "@/mocks/mockBackend";
import { connectSimulation, fetchEconomicReport } from "@/services/wsClient";
import type { SimEvent, SimMetrics } from "@/types";
import type {
  EconomicReport,
  BackendInfluenceEvent,
  BackendNPC,
  BackendRelationship,
  SavedSimulation,
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
  eggIndex: 1.0,
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

/** Cap history to last N snapshots (one per round). */
const MAX_HISTORY = 30;

interface SimulationState {
  events: SimEvent[];
  metrics: SimMetrics;
  metricsHistory: SimMetrics[];
  phase: number;
  round: number;
  maxRounds: number;
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

export function useSimulation(simulationId?: string, record = false) {
  const [state, setState] = useState<SimulationState>({
    events: [],
    metrics: { ...INITIAL_METRICS },
    metricsHistory: [{ ...INITIAL_METRICS }],
    phase: 0,
    round: 0,
    maxRounds: 1,
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
  const [report, setReport] = useState<EconomicReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);
  const recordingRef = useRef<SavedSimulation | null>(null);
  const npcsStreamedRef = useRef(false);
  const npcLookupRef = useRef<Map<string, BackendNPC>>(new Map());
  const relationshipsRef = useRef<BackendRelationship[]>([]);
  const influenceLogRef = useRef<BackendInfluenceEvent[]>([]);
  const metricsAccRef = useRef<MetricsAccumulator>(createAccumulator());
  const eventQueueRef = useRef<SimEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRoundsRef = useRef(15);
  const lastPhaseRef = useRef(0);
  const reportRequestedRef = useRef(false);

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
        eventBridge.emitPhaseChange(event.phase, event.round);
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
        round: event.round > prev.round ? event.round : prev.round,
        maxRounds: event.maxRounds,
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

      const { phase } = roundToPhase(round, maxRoundsRef.current);
      if (phase > lastPhaseRef.current) {
        lastPhaseRef.current = phase;
        eventQueueRef.current.push({
          id: `phase-${phase}`,
          type: "phase_change",
          agentId: "system",
          agentName: "System",
          message: PHASE_LABELS[phase] || `Phase ${phase}`,
          phase,
          round,
          maxRounds: maxRoundsRef.current,
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
      setState((prev) => {
        const merged = { ...prev.metrics, ...newMetrics };
        return {
          ...prev,
          metrics: merged,
          metricsHistory: [...prev.metricsHistory, merged].slice(-MAX_HISTORY),
        };
      });

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
      metricsHistory: [{ ...INITIAL_METRICS }],
      phase: 0,
      round: 0,
      maxRounds: 1,
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
    setReport(null);
    setReportLoading(false);
    setReportError(null);
    reportRequestedRef.current = false;

    // ── Mock backend path ──────────────────────────────────
    if (USE_MOCK) {
      const mock = generateMockSimulation(maxRoundsRef.current);
      if (record) {
        recordingRef.current = {
          version: 1,
          savedAt: new Date().toISOString(),
          maxRounds: maxRoundsRef.current,
          initMsg: mock.initMsg,
          rounds: mock.rounds,
        };
      }
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

    if (record) {
      recordingRef.current = {
        version: 1,
        savedAt: new Date().toISOString(),
        maxRounds: maxRoundsRef.current,
        initMsg: { type: "init", npcs: [], relationships: [] },
        rounds: [],
      };
    }

    npcsStreamedRef.current = false;
    getBridge().then(({ eventBridge }) => eventBridge.emitResetNPCs());

    console.log("[sim] start() called — connecting WS for sim=%s", simId);

    try {
      const cleanup = connectSimulation(simId, {
        onPolicyAnalysis: (msg) => {
          console.log(
            "[sim] policy_analysis received — %d entities",
            msg.entities?.length ?? 0,
          );
        },

        onNPCAdded: (msg) => {
          const npc = msg.npc;
          npcLookupRef.current.set(npc.id, npc);
          npcsStreamedRef.current = true;
          getBridge().then(({ eventBridge }) => eventBridge.emitAddNPC(npc));
        },

        onInit: (msg) => {
          console.log(
            "[sim] init received — %d NPCs, %d relationships",
            msg.npcs.length,
            msg.relationships.length,
          );
          if (recordingRef.current) {
            recordingRef.current.initMsg = msg;
          }
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

          if (!npcsStreamedRef.current) {
            getBridge().then(({ eventBridge }) => {
              eventBridge.emitInitNPCs(msg.npcs);
            });
          }
        },

        onRound: (msg: WSRoundMsg) => {
          console.log(
            "[sim] round %d — %d events, %d NPCs",
            msg.round,
            msg.events.length,
            msg.npcs.length,
          );
          if (recordingRef.current) {
            recordingRef.current.rounds.push(msg);
            recordingRef.current.maxRounds = Math.max(
              recordingRef.current.maxRounds,
              msg.round + 1,
            );
          }
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
  }, [simulationId, record, processRound, processNPCEvents]);

  const startFromRecording = useCallback(
    (recording: SavedSimulation) => {
    setState({
        events: [],
        metrics: { ...INITIAL_METRICS },
        metricsHistory: [{ ...INITIAL_METRICS }],
        phase: 0,
        round: 0,
        maxRounds: 1,
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
      setReport(null);
      setReportLoading(false);
      setReportError(null);
      reportRequestedRef.current = false;

      maxRoundsRef.current = recording.maxRounds || recording.rounds.length;
      const lookup = npcLookupRef.current;
      for (const npc of recording.initMsg.npcs) lookup.set(npc.id, npc);
      relationshipsRef.current = recording.initMsg.relationships;
      setGraphData((prev) => ({
        ...prev,
        relationships: recording.initMsg.relationships,
        npcs: recording.initMsg.npcs,
        version: prev.version + 1,
      }));
      getBridge().then(({ eventBridge }) => {
        eventBridge.emitInitNPCs(recording.initMsg.npcs);
      });

      let i = 0;
      const feedNext = () => {
        if (i >= recording.rounds.length) {
          waitForQueueDrain(eventQueueRef, setState);
          return;
        }
        processRound(recording.rounds[i++]);
        const t = setTimeout(feedNext, 150 + Math.random() * 100);
        cleanupRef.current = () => clearTimeout(t);
      };
      feedNext();
    },
    [processRound],
  );

  const getRecording = useCallback(() => recordingRef.current, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (
      !simulationId ||
      USE_MOCK ||
      !state.isComplete ||
      reportRequestedRef.current
    ) {
      return;
    }

    reportRequestedRef.current = true;
    setReportLoading(true);
    setReportError(null);

    fetchEconomicReport(simulationId)
      .then((data) => {
        setReport(data);
      })
      .catch((error: Error) => {
        console.error("[sim] economic report error:", error);
        setReportError(error.message);
      })
      .finally(() => {
        setReportLoading(false);
      });
  }, [simulationId, state.isComplete]);

  const getNpc = useCallback((id: string) => npcLookupRef.current.get(id), []);

  return {
    ...state,
    start,
    startFromRecording,
    getRecording,
    graphData,
    getNpc,
    report,
    reportLoading,
    reportError,
  };
}
