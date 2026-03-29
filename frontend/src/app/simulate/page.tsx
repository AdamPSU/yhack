"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { Dashboard } from "@/components/Dashboard";
import { EventFeed } from "@/components/EventFeed";
import { NPCProfileModal } from "@/components/NPCProfileModal";
import { useSimulation } from "@/hooks/useSimulation";
import { clearReplayData, getReplayData } from "@/lib/replayStore";
import type { NPCHoverInfo, NPCState, SimEvent } from "@/types";

const SocialGraph = dynamic(
  () =>
    import("@/components/SocialGraph").then((m) => ({
      default: m.SocialGraph,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[8px] font-pixel text-white/20 uppercase tracking-widest">
        Loading graph...
      </div>
    ),
  },
);

// Mirror game/config constants here to avoid importing Phaser during SSR.
// game/config.ts imports Phaser at top level which requires `window`.
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 960;
const SCALE_FACTOR = 1; // game runs natively at 1280×960 — no upscale factor
const BORDER_WIDTH = 2; // rpg-panel border

// Phaser requires browser APIs — must be client-only
const GameCanvas = dynamic(
  () =>
    import("@/components/GameCanvas").then((m) => ({ default: m.GameCanvas })),
  { ssr: false, loading: () => <GameCanvasPlaceholder /> },
);

function GameCanvasPlaceholder() {
  return (
    <div
      className="rpg-panel flex items-center justify-center box-border bg-black/80 border-white/10 backdrop-blur-md"
      style={{
        width: GAME_WIDTH * SCALE_FACTOR,
        height: GAME_HEIGHT * SCALE_FACTOR,
      }}
    >
      <span className="text-[8px] font-pixel text-white/20 uppercase tracking-widest animate-pulse">
        Loading world...
      </span>
    </div>
  );
}

const PHASE_LABELS: Record<number, string> = {
  1: "Announcement & Assessment",
  2: "Economic Ripple Effects",
  3: "Social Crisis & Reckoning",
};

const SENTIMENT_LABEL: Record<
  NPCHoverInfo["sentiment"],
  { symbol: string; color: string; glow: string }
> = {
  happy: { symbol: "+", color: "text-teal-400", glow: "neon-text-teal" },
  neutral: { symbol: "~", color: "text-white/40", glow: "" },
  worried: { symbol: "?", color: "text-yellow-400", glow: "neon-text-yellow" },
  angry: { symbol: "!", color: "text-pink-500", glow: "neon-text-pink" },
};

function NPCTooltip({ info }: { info: NPCHoverInfo }) {
  const sent = SENTIMENT_LABEL[info.sentiment];
  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: info.x * SCALE_FACTOR + BORDER_WIDTH + 16,
        top: info.y * SCALE_FACTOR + BORDER_WIDTH - 4,
      }}
    >
      <div className="rounded border border-white/10 bg-black/90 px-2 py-1 shadow-2xl backdrop-blur-md neon-border-purple">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-pixel text-purple-400 neon-text-purple">
            {info.name}
          </span>
          <span className={`text-[10px] font-pixel ${sent.color} ${sent.glow}`}>
            [{sent.symbol}]
          </span>
        </div>
        <div className="text-[8px] font-mono tracking-widest uppercase text-white/40">{info.role}</div>
      </div>
    </div>
  );
}

interface BubbleState {
  npcId: string;
  agentName: string;
  agentCategory?: string;
  message: string;
  x: number;
  y: number;
}

export default function SimulatePage() {
  return (
    <Suspense fallback={<GameCanvasPlaceholder />}>
      <SimulateContent />
    </Suspense>
  );
}

function SimulateContent() {
  const searchParams = useSearchParams();
  const isMock = process.env.NEXT_PUBLIC_MOCK_BACKEND === "true";
  const simulationId = searchParams.get("id") || "";
  const isReplay = searchParams.get("mode") === "replay";
  const isRecording = searchParams.get("record") === "true";
  const sim = useSimulation(simulationId || undefined, isRecording);
  const [bubbles, setBubbles] = useState<Map<string, BubbleState>>(new Map());
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);

  const handleEventClick = useCallback(
    (event: SimEvent) => {
      setSelectedNpcId(event.agentId);
      import("@/game/bridge/EventBridge").then(({ eventBridge }) => {
        eventBridge.emitCameraSnapToNPC(event.agentId);
      });
    },
    [],
  );

  const selectedNpc = selectedNpcId ? sim.getNpc(selectedNpcId) : undefined;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<NPCHoverInfo | null>(null);
  const [showGraph, setShowGraph] = useState(false);

  // Auto-start simulation once we have a simulation ID (or immediately in mock/replay mode)
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (hasStartedRef.current) return;
    if (isReplay) {
      const data = getReplayData();
      if (data) {
        hasStartedRef.current = true;
        clearReplayData();
        sim.startFromRecording(data);
      }
    } else if (simulationId || isMock) {
      hasStartedRef.current = true;
      sim.start();
    }
    return () => {
      hasStartedRef.current = false;
    };
  }, [simulationId, isReplay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for NPC position updates from Phaser — only source for bubble positions
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import("@/game/bridge/EventBridge").then(({ eventBridge }) => {
      const handler = (npc: NPCState) => {
        setBubbles((prev) => {
          const next = new Map(prev);
          if (npc.message) {
            next.set(npc.id, {
              npcId: npc.id,
              agentName: npc.name,
              agentCategory: npc.category,
              message: npc.message,
              x: npc.x,
              y: npc.y,
            });
          } else {
            next.delete(npc.id);
          }
          return next;
        });
      };
      eventBridge.on("sim:npc-position", handler);
      cleanup = () => eventBridge.off("sim:npc-position", handler);
    });
    return () => cleanup?.();
  }, []);

  // Listen for NPC hover events from Phaser
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import("@/game/bridge/EventBridge").then(({ eventBridge }) => {
      const onHover = (info: NPCHoverInfo) => setHoverInfo(info);
      const onHoverOut = () => setHoverInfo(null);
      eventBridge.on("sim:npc-hover", onHover);
      eventBridge.on("sim:npc-hover-out", onHoverOut);
      cleanup = () => {
        eventBridge.off("sim:npc-hover", onHover);
        eventBridge.off("sim:npc-hover-out", onHoverOut);
      };
    });
    return () => cleanup?.();
  }, []);

  // Open NPC profile when clicked on canvas
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    import("@/game/bridge/EventBridge").then(({ eventBridge }) => {
      const handler = (data: { npcId: string }) => {
        setSelectedNpcId(data.npcId);
        eventBridge.emitCameraSnapToNPC(data.npcId);
      };
      eventBridge.on("sim:npc-click", handler);
      cleanup = () => eventBridge.off("sim:npc-click", handler);
    });
    return () => cleanup?.();
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }, []);

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Camera panning via click+drag
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.style.cursor = "grabbing";
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      import("@/game/bridge/EventBridge").then(({ eventBridge }) => {
        eventBridge.emitCameraPan(-dx / SCALE_FACTOR, -dy / SCALE_FACTOR);
      });
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = "grab";
      el.releasePointerCapture(e.pointerId);
    };

    el.style.cursor = "grab";
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
  }, []);

  // Close graph modal on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowGraph(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Camera zoom via scroll wheel
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -1 : 1;
      import("@/game/bridge/EventBridge").then(({ eventBridge }) => {
        eventBridge.emitCameraZoom(delta);
      });
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const bubbleList = Array.from(bubbles.values());

  if (!simulationId && !isMock && !isReplay) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#060010] px-6">
        <div className="rpg-panel flex max-w-md flex-col items-center gap-4 p-8 text-center bg-black/80 border-white/10 neon-border-purple shadow-2xl">
          <span className="text-[10px] font-pixel tracking-widest text-purple-400 neon-text-purple">
            SIMULACRA
          </span>
          <p className="text-[10px] font-mono text-white/80 uppercase tracking-widest neon-text-white">
            No policy specified.
          </p>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
            Please describe an economic policy on the home page before running a
            simulation.
          </p>
          <Link
            href="/"
            className="rpg-panel mt-2 px-6 py-2 text-[10px] font-pixel text-purple-400 transition-all duration-150 hover:bg-purple-900/20 hover:border-purple-400/50 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] neon-border-purple"
          >
            {">> Enter Policy <<"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-[#060010]"
      data-testid="simulate-page"
    >
      {/* Phase indicator bar */}
      <div
        className="rpg-panel flex h-10 shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-4 bg-black/80 border-white/10 backdrop-blur-md"
        data-testid="phase-bar"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-pixel tracking-tight text-purple-400 neon-text-purple">
            SIMULACRA
          </span>
          <span className="text-[10px] font-mono text-white/10">|</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((p) => (
              <div
                key={p}
                className={`h-2 w-12 border border-white/5 transition-colors duration-500 ${sim.phase >= p ? (p === 3 ? "bg-pink-500 neon-pink" : p === 2 ? "bg-yellow-400 neon-yellow" : "bg-teal-400 neon-teal") : "bg-white/5"}`}
              />
            ))}
          </div>
          {sim.phase > 0 && (
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest ml-2">
              {PHASE_LABELS[sim.phase]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {sim.isRunning && isRecording && (
            <span className="text-[9px] font-pixel text-pink-500 neon-text-pink animate-pulse">
              REC
            </span>
          )}
          {sim.isComplete && (
            <>
              <span className="text-[9px] font-pixel text-teal-400 neon-text-teal">
                COMPLETE
              </span>
              {sim.getRecording() && (
                <button
                  type="button"
                  onClick={() => {
                    const recording = sim.getRecording();
                    if (!recording) return;
                    const blob = new Blob(
                      [JSON.stringify(recording, null, 2)],
                      { type: "application/json" },
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `agora-sim-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[9px] font-mono text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest"
                >
                  [Save JSON]
                </button>
              )}
            </>
          )}
          {sim.isRunning && !isRecording && (
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest">
              Simulating...
            </span>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 gap-2 overflow-hidden p-2">
        {/* Left: Event feed */}
        <div className="rpg-panel flex h-full w-64 shrink-0 flex-col bg-black/40 border-white/10">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <h2 className="text-[8px] font-pixel uppercase text-purple-400">
              Event Log
            </h2>
            <button
              type="button"
              onClick={() => setShowGraph(true)}
              className="text-[9px] font-mono text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest"
              title="Open Social Graph"
            >
              [Graph]
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <EventFeed events={sim.events} onEventClick={handleEventClick} />
          </div>
        </div>

        {/* Center: Game canvas with chat bubble overlays */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          <div ref={canvasContainerRef} className="relative shrink-0">
            <GameCanvas />

            {/* Fullscreen toggle + Zoom controls */}
            <div className="absolute top-2 right-2 z-40 flex gap-1">
              <button
                type="button"
                onClick={() => {
                  import("@/game/bridge/EventBridge").then(
                    ({ eventBridge }) => {
                      eventBridge.emitCameraZoom(1);
                    },
                  );
                }}
                className="rpg-panel px-1.5 py-1 text-[10px] font-mono text-white/40 hover:text-white/90 hover:border-white/40 bg-black/60 border-white/10 transition-colors"
                title="Zoom in"
              >
                [+]
              </button>
              <button
                type="button"
                onClick={() => {
                  import("@/game/bridge/EventBridge").then(
                    ({ eventBridge }) => {
                      eventBridge.emitCameraZoom(-1);
                    },
                  );
                }}
                className="rpg-panel px-1.5 py-1 text-[10px] font-mono text-white/40 hover:text-white/90 hover:border-white/40 bg-black/60 border-white/10 transition-colors"
                title="Zoom out"
              >
                [-]
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="rpg-panel px-1.5 py-1 text-[10px] font-mono text-white/40 hover:text-white/90 hover:border-white/40 bg-black/60 border-white/10 transition-colors"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? "[X]" : "[ ]"}
              </button>
            </div>

            {/* Chat bubbles anchored to NPCs */}
            {bubbleList.map((b) => (
              <ChatBubble
                key={b.npcId}
                agentName={b.agentName}
                agentCategory={b.agentCategory}
                message={b.message}
                x={b.x * SCALE_FACTOR + BORDER_WIDTH}
                y={b.y * SCALE_FACTOR + BORDER_WIDTH}
              />
            ))}

            {/* NPC hover tooltip */}
            {hoverInfo && <NPCTooltip info={hoverInfo} />}
          </div>
        </div>

        {/* Right: Dashboard */}
        <div className="shrink-0">
          <Dashboard
            metrics={sim.metrics}
            metricsHistory={sim.metricsHistory}
            phase={sim.phase}
            month={sim.month}
          />
        </div>
      </div>

      {/* NPC Profile Modal */}
      {selectedNpc && (
        <NPCProfileModal
          npc={selectedNpc}
          onClose={() => setSelectedNpcId(null)}
        />
      )}

      {/* Social Graph Modal */}
      {showGraph && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGraph(false);
          }}
        >
          <div
            className="rpg-panel relative flex flex-col bg-[#060010] border-white/20 shadow-2xl"
            style={{ width: 700, height: 560 }}
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
              <h2 className="text-[10px] font-pixel uppercase text-purple-400">
                Social Graph
              </h2>
              <button
                type="button"
                onClick={() => setShowGraph(false)}
                className="text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest"
              >
                [ESC]
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SocialGraph
                npcs={sim.graphData.npcs}
                relationships={sim.graphData.relationships}
                influenceEvents={sim.graphData.influenceEvents}
                version={sim.graphData.version}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
