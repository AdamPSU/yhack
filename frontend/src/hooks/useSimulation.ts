"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SimEvent, SimMetrics } from "@/lib/types";
import { INITIAL_METRICS, MOCK_EVENTS } from "@/lib/mockData";

interface SimulationState {
  events: SimEvent[];
  metrics: SimMetrics;
  phase: number;
  month: number;
  isRunning: boolean;
  isComplete: boolean;
}

export function useSimulation() {
  const [state, setState] = useState<SimulationState>({
    events: [],
    metrics: { ...INITIAL_METRICS },
    phase: 0,
    month: 0,
    isRunning: false,
    isComplete: false,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);

  const pushNextEvent = useCallback(() => {
    const idx = indexRef.current;
    if (idx >= MOCK_EVENTS.length) {
      setState((prev) => ({ ...prev, isRunning: false, isComplete: true }));
      return;
    }

    const event = MOCK_EVENTS[idx];
    indexRef.current = idx + 1;

    // Bridge to Phaser: emit event so game world reacts
    // Dynamic import avoids pulling Phaser into SSR bundle
    import("@/game/bridge/EventBridge").then(({ eventBridge }) => {
      if (event.type === "phase_change") {
        eventBridge.emitPhaseChange(event.phase, event.month);
      }
      eventBridge.emitSimEvent(event);
    });

    setState((prev) => {
      const newMetrics = event.metrics
        ? { ...prev.metrics, ...event.metrics }
        : prev.metrics;

      return {
        ...prev,
        events: [...prev.events, event],
        metrics: newMetrics,
        phase: event.phase > prev.phase ? event.phase : prev.phase,
        month: event.month > prev.month ? event.month : prev.month,
      };
    });

    // Schedule next event with variable delay
    const delay = event.type === "phase_change" ? 2000 : 1200 + Math.random() * 600;
    timerRef.current = setTimeout(pushNextEvent, delay);
  }, []);

  const start = useCallback(() => {
    indexRef.current = 0;
    setState({
      events: [],
      metrics: { ...INITIAL_METRICS },
      phase: 0,
      month: 0,
      isRunning: true,
      isComplete: false,
    });
    // Kick off after a short delay so UI can render
    timerRef.current = setTimeout(pushNextEvent, 800);
  }, [pushNextEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    ...state,
    start,
    latestEvent: state.events[state.events.length - 1] ?? null,
  };
}
