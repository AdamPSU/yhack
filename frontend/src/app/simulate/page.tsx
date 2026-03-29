"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { Dashboard } from "@/components/Dashboard";
import { EventFeed } from "@/components/EventFeed";
import { useSimulation } from "@/hooks/useSimulation";
import type { NPCHoverInfo, NPCState } from "@/types";

// Mirror game/config constants here to avoid importing Phaser during SSR.
// game/config.ts imports Phaser at top level which requires `window`.
const GAME_WIDTH = 640;
const GAME_HEIGHT = 480;
const SCALE_FACTOR = 2;

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
        width: GAME_WIDTH * SCALE_FACTOR + 4,
        height: GAME_HEIGHT * SCALE_FACTOR + 4,
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
        left: info.x * SCALE_FACTOR + 16,
        top: info.y * SCALE_FACTOR - 4,
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
  x: number;
  y: number;
}

export default function SimulatePage() {
  const [policyText, setPolicyText] = useState<string>("");
  const sim = useSimulation(policyText);
  const [bubbles, setBubbles] = useState<Map<string, BubbleState>>(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<NPCHoverInfo | null>(null);
  // Load policy text from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("agora-policy");
    if (stored) {
      setPolicyText(stored);
    }
  }, []);

  // Auto-start simulation once policy text is available
  useEffect(() => {
    if (policyText && !sim.isRunning && !sim.isComplete) {
      sim.start();
    }
  }, [policyText]); // eslint-disable-line react-hooks/exhaustive-deps

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
              x: npc.x * SCALE_FACTOR,
              y: npc.y * SCALE_FACTOR,
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

  const bubbleList = Array.from(bubbles.values());

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-[#1a1510]"
      data-testid="simulate-page"
    >
      {/* Phase indicator bar */}
      <div
        className="rpg-panel flex h-10 shrink-0 items-center justify-between rounded-none border-x-0 border-t-0 px-4"
        data-testid="phase-bar"
      >
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#e8a43a]">
            AGORA
          </span>
          <span className="text-[10px] font-mono text-[#4a3c2a]">|</span>
          <div className="flex gap-1">
            {[1, 2, 3].map((p) => (
              <div
                key={p}
                className={`h-2 w-12 border border-[#3a2e1e] transition-colors duration-500 ${sim.phase >= p ? (p === 3 ? "bg-[#d45050]" : p === 2 ? "bg-[#e8a43a]" : "bg-[#5ab85a]") : "bg-[#251e15]"}`}
              />
            ))}
          </div>
          {sim.phase > 0 && (
            <span className="text-[10px] font-mono text-[#8a7a62]">
              {PHASE_LABELS[sim.phase]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {sim.isComplete && (
            <span className="text-[10px] font-mono font-bold text-[#5ab85a]">
              COMPLETE
            </span>
          )}
          {sim.isRunning && (
            <span className="text-[10px] font-mono text-[#8a7a62]">
              Simulating...
            </span>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 gap-2 overflow-hidden p-2">
        {/* Left: Event feed */}
        <div className="shrink-0">
          <EventFeed events={sim.events} />
        </div>

        {/* Center: Game canvas with chat bubble overlays */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden">
          <div ref={canvasContainerRef} className="relative shrink-0">
            <GameCanvas />

            {/* Fullscreen toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="absolute top-2 right-2 z-40 rpg-panel px-1.5 py-1 text-[10px] font-mono text-[#8a7a62] hover:text-[#e8a43a] hover:border-[#e8a43a] transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? "[X]" : "[ ]"}
            </button>

            {/* Chat bubbles anchored to NPCs */}
            {bubbleList.map((b) => (
              <ChatBubble
                key={b.npcId}
                agentName={b.agentName}
                message={b.message}
                x={b.x + 8}
                y={b.y}
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
            phase={sim.phase}
            month={sim.month}
          />
        </div>
      </div>
    </div>
  );
}
