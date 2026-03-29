"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import ASCIITextHero from "@/components/ASCIIText/ASCIITextHero";
import IntroAnimation from "@/components/IntroAnimation";
import LiquidEtherBackground from "@/components/LiquidEther/LiquidEtherBackground";
import NodeCanvasClient from "@/components/NodeCanvas/NodeCanvasClient";
import RetroTV from "@/components/RetroTV";
import { setReplayData } from "@/lib/replayStore";
import type { SavedSimulation } from "@/types/backend";

function isSavedSimulation(data: unknown): data is SavedSimulation {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<SavedSimulation>;
  return (
    candidate.initMsg?.type === "init" &&
    Array.isArray(candidate.initMsg.npcs) &&
    Array.isArray(candidate.rounds)
  );
}

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  const handleLoadPlay = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const module = await import("../../play.json");
      const replay = module.default as unknown;
      if (!isSavedSimulation(replay)) {
        console.error("Bundled play.json is invalid");
        setIsSubmitting(false);
        return;
      }
      setReplayData(replay);
      router.push("/simulate?mode=replay&map=citypack");
    } catch (err) {
      console.error("Failed to load bundled play.json:", err);
      setIsSubmitting(false);
    }
  }, [isSubmitting, router]);

  return (
    <AnimatePresence mode="wait">
      {showIntro ? (
        <IntroAnimation key="intro" onComplete={handleIntroComplete} />
      ) : (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2.5, ease: "easeOut" }}
          className="relative flex h-screen flex-col items-center justify-center overflow-hidden"
        >
          <LiquidEtherBackground />
          <RetroTV />
          <main
            className="relative flex w-full flex-col items-center gap-4 px-8 -mt-24"
            data-testid="landing-page"
          >
            {/* Title */}
            <div className="relative z-[100] w-full max-w-2xl text-center">
              <ASCIITextHero />
              <p
                className="text-[10px] tracking-[0.3em] uppercase text-white/40 mt-[4px] italic neon-text-white"
                style={{
                  textShadow:
                    "0 0 12px rgba(255,255,255,0.4), 0 0 30px rgba(255,255,255,0.2)",
                }}
              >
                Synthetic Individual Modeling & Universal Logic Agent-based Complex Response Analysis
              </p>
            </div>

            {/* Node canvas */}
            <div className="relative z-[10] mt-12 w-full">
              <NodeCanvasClient />
            </div>

            <div className="relative z-[20] mt-4 flex w-full justify-center">
              <button
                type="button"
                onClick={handleLoadPlay}
                disabled={isSubmitting}
                data-testid="load-play-button"
                className="pointer-events-auto rounded-lg border border-white/20 bg-black/70 px-6 py-3 text-[10px] font-pixel uppercase tracking-[0.25em] text-white/80 backdrop-blur-md transition hover:border-cyan-300/70 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Loading Replay..." : "Load Play Replay"}
              </button>
            </div>
          </main>

          {/* Footer - Fixed to bottom, non-scrollable */}
          <footer className="fixed bottom-0 left-0 right-0 z-[110] flex flex-col items-center pointer-events-none">
            {/* The "Peeking" Box (clipped to bottom) */}
            <div className="rpg-panel w-full max-w-xl px-10 py-3 translate-y-[calc(30%-10px)] border-b-0 rounded-t-lg bg-black/80 backdrop-blur-md flex justify-between items-center opacity-100">
              <div className="flex flex-col gap-1">
                <span className="text-[8px] font-pixel text-white/40 uppercase tracking-tight">
                  System Status
                </span>
                <span className="text-[10px] font-pixel text-purple-400 uppercase tracking-widest">
                  Ready for Simulation
                </span>
              </div>
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[8px] font-pixel text-white/40 uppercase">
                    Agents
                  </span>
                  <span className="text-[10px] font-pixel text-white">
                    25.00
                  </span>
                </div>
                <div className="h-10 w-[1px] bg-white/10" />
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[8px] font-pixel text-white/40 uppercase">
                    Grid
                  </span>
                  <span className="text-[10px] font-pixel text-white">
                    20x15
                  </span>
                </div>
              </div>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
