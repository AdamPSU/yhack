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
      <div className="flex h-full items-center justify-center text-[10px] font-mono text-[#5a4a32]">
        Loading graph...
      </div>
    ),
  },
);

// Mirror game/constants values here to avoid importing Phaser during SSR.
// game/config.ts imports Phaser at top level which requires `window`.
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 960;
const SCALE_FACTOR = 1; // must match constants.ts — 1:1, Phaser Scale.FIT handles display
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
      className="rpg-panel flex items-center justify-center box-border"
      style={{
        width: GAME_WIDTH * SCALE_FACTOR,
        height: GAME_HEIGHT * SCALE_FACTOR,
      }}
    >
      <span className="text-xs font-mono text-[#5a4a32]">Loading world...</span>
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
  { symbol: string; color: string }
> = {
  happy: { symbol: "+", color: "text-[#5ab85a]" },
  neutral: { symbol: "~", color: "text-[#8a7a62]" },
  worried: { symbol: "?", color: "text-[#e8a43a]" },
  angry: { symbol: "!", color: "text-[#d45050]" },
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
      <div className="rounded bg-[#1a1510]/95 border border-[#4a3c2a] px-2 py-1 shadow-lg">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-bold text-[#e8a43a]">
            {info.name}
          </span>
          <span className={`text-[10px] font-mono font-bold ${sent.color}`}>
            [{sent.symbol}]
          </span>
        </div>
        <div className="text-[9px] font-mono text-[#8a7a62]">{info.role}</div>
      </div>
    </div>
  );
}

interface BubbleState {
  npcId: string;
  agentName: string;
  message: string;
  role: string;
  x: number;
  y: number;
}

function roleToBubbleColor(role: string): "orange" | "blue" | "yellow" {
  switch (role) {
    case "politician":
    case "business_owner":
    case "shopkeeper":
      return "blue";
    case "retiree":
    case "farmer":
      return "yellow";
    default:
      return "orange";
  }
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
              message: npc.message,
              role: npc.role ?? "",
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#1a1510] px-6">
        <div className="rpg-panel flex max-w-md flex-col items-center gap-4 p-8 text-center">
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#e8a43a]">
            AGORA
          </span>
          <p className="text-sm font-mono text-[#d4c4a0]">
            No policy specified.
          </p>
          <p className="text-xs font-mono text-[#8a7a62]">
            Please describe an economic policy on the home page before running a
            simulation.
          </p>
          <Link
            href="/"
            className="rpg-panel mt-2 px-6 py-2 text-xs font-mono font-bold text-[#e8a43a] transition-all duration-150 hover:bg-[#2a2218] hover:border-[#e8a43a] hover:shadow-[0_0_8px_rgba(232,164,58,0.2)]"
          >
            {">> Enter Policy <<"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-[#1a1510]"
      data-testid="simulate-page"
    >
      {/* Phase indicator bar — scanline overlay + grid dots */}
      <div
        className="rpg-panel scanline-overlay grid-dot-bg flex h-10 shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-4"
        data-testid="phase-bar"
      >
        <div className="relative z-[2] flex items-center gap-3">
          <span className="text-[11px] font-mono font-bold tracking-[0.25em] uppercase text-[#e8a43a] logo-glow">
            AGORA
          </span>
          <span className="text-[10px] font-mono text-[#3a2e1e]">///</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((p) => {
              const isActive = sim.phase >= p;
              const bgColor = isActive ? (p === 3 ? "bg-[#d45050]" : p === 2 ? "bg-[#e8a43a]" : "bg-[#5ab85a]") : "bg-[#251e15]";
              return (
                <div
                  key={p}
                  className={`h-2 w-14 border border-[#3a2e1e] transition-all duration-500 ${bgColor} ${isActive && sim.phase === p ? "phase-segment-active" : ""}`}
                />
              );
            })}
          </div>
          {sim.phase > 0 && (
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#6a5a42]">
              {PHASE_LABELS[sim.phase]}
            </span>
          )}
        </div>

        <div className="relative z-[2] flex items-center gap-3">
          {sim.isRunning && isRecording && (
            <span className="text-[10px] font-mono font-bold text-[#d45050] animate-pulse">
              [REC]
            </span>
          )}
          {sim.isComplete && (
            <>
              <span className="text-[10px] font-mono font-bold tracking-wider text-[#5ab85a]">
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
                  className="terminal-btn"
                >
                  SAVE JSON
                </button>
              )}
            </>
          )}
          {sim.isRunning && !isRecording && (
            <span className="text-[10px] font-mono tracking-wider text-[#6a5a42] terminal-cursor">
              SIMULATING
            </span>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 gap-2 overflow-hidden p-2">
        {/* Left: Event feed */}
        <div className="rpg-panel grid-dot-bg flex h-full w-64 shrink-0 flex-col">
          <div className="scanline-overlay flex items-center justify-between border-b border-[#3a2e1e] px-3 py-2">
            <h2 className="relative z-[2] text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#e8a43a]">
              Event Log
            </h2>
            <button
              type="button"
              onClick={() => setShowGraph(true)}
              className="relative z-[2] terminal-btn"
              title="Open Social Graph"
            >
              GRAPH
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <EventFeed events={sim.events} onEventClick={handleEventClick} />
          </div>
        </div>

        {/* Center: Game canvas with chat bubble overlays */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          <div ref={canvasContainerRef} className="relative shrink-0 canvas-glow" style={{ border: "2px solid #4a3c2a", borderRadius: 2 }}>
            <GameCanvas />

            {/* Fullscreen toggle + Zoom controls — terminal buttons */}
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
                className="terminal-btn"
                title="Zoom in"
              >
                ZOOM+
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
                className="terminal-btn"
                title="Zoom out"
              >
                ZOOM-
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="terminal-btn"
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? "EXIT" : "FULL"}
              </button>
            </div>

            {/* Chat bubbles anchored to NPCs */}
            {bubbleList.map((b) => {
              const cx = b.x * SCALE_FACTOR + BORDER_WIDTH;
              const cy = b.y * SCALE_FACTOR + BORDER_WIDTH;
              if (cx < 0 || cy < 0 || cx > GAME_WIDTH * SCALE_FACTOR || cy > GAME_HEIGHT * SCALE_FACTOR) return null;
              return (
                <ChatBubble
                  key={b.npcId}
                  agentName={b.agentName}
                  message={b.message}
                  x={cx}
                  y={cy}
                  color={roleToBubbleColor(b.role)}
                />
              );
            })}

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGraph(false);
          }}
        >
          <div
            className="rpg-panel relative flex flex-col"
            style={{ width: 700, height: 560 }}
          >
            <div className="flex items-center justify-between border-b border-[#3a2e1e] px-4 py-2">
              <h2 className="text-[11px] font-mono font-bold uppercase text-[#e8a43a]">
                Social Graph
              </h2>
              <button
                type="button"
                onClick={() => setShowGraph(false)}
                className="text-[10px] font-mono text-[#5a4a32] hover:text-[#e8a43a] transition-colors"
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
