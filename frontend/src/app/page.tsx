'use client';

import LiquidEtherBackground from "@/components/LiquidEther/LiquidEtherBackground";
import ASCIITextHero from "@/components/ASCIIText/ASCIITextHero";
import RetroTV from "@/components/RetroTV";
import DecryptedText from "@/components/DecryptedText";
import NodeCanvasClient from "@/components/NodeCanvas/NodeCanvasClient";
import IntroAnimation from "@/components/IntroAnimation";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  const handleSimulate = useCallback(() => {
    setIsSubmitting(true);
    // Wait for the decrypt animation to finish before routing
    setTimeout(() => {
      router.push("/simulate");
    }, 1500);
  }, [router]);

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
            className="text-[10px] tracking-[0.3em] uppercase text-white/40 mt-[4px] italic"
            style={{ textShadow: "0 0 12px rgba(255,255,255,0.4), 0 0 30px rgba(255,255,255,0.2)" }}
          >
            Agent-based Governance and Outcome Response Analysis
          </p>
        </div>

        {/* Node canvas */}
        <div className="relative z-[10] mt-12 w-full">
          <NodeCanvasClient />
        </div>
      </main>

      {/* Footer - Fixed to bottom, non-scrollable */}
      <footer 
        className="fixed bottom-0 left-0 right-0 z-[110] flex flex-col items-center pointer-events-none"
      >
        {/* The "Peeking" Box (clipped to bottom) */}
        <div className="rpg-panel w-full max-w-xl px-10 py-3 translate-y-[calc(30%-10px)] border-b-0 rounded-t-lg bg-black/80 backdrop-blur-md flex justify-between items-center opacity-100">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-pixel text-white/40 uppercase tracking-tight">System Status</span>
            <span className="text-[10px] font-pixel text-purple-400 uppercase tracking-widest">Ready for Simulation</span>
          </div>
          <div className="flex items-center gap-8">
             <div className="flex flex-col items-end gap-1">
               <span className="text-[8px] font-pixel text-white/40 uppercase">Agents</span>
               <span className="text-[10px] font-pixel text-white">25.00</span>
             </div>
             <div className="h-10 w-[1px] bg-white/10" />
             <div className="flex flex-col items-end gap-1">
               <span className="text-[8px] font-pixel text-white/40 uppercase">Grid</span>
               <span className="text-[10px] font-pixel text-white">20x15</span>
             </div>
          </div>
        </div>
      </footer>
    </motion.div>
    )}
    </AnimatePresence>
  );
}
