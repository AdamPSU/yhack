"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import IntroAnimation from "@/components/IntroAnimation";
import { SimLoadingScreen } from "@/components/SimLoadingScreen";
import { setReplayData } from "@/lib/replayStore";
import type { SavedSimulation } from "@/types/backend";

const NodeCanvasClient = dynamic(
  () => import("@/components/NodeCanvas/NodeCanvasClient"),
  { ssr: false },
);

function isSavedSimulation(data: unknown): data is SavedSimulation {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<SavedSimulation>;
  return (
    candidate.initMsg?.type === "init" &&
    Array.isArray(candidate.initMsg.npcs) &&
    Array.isArray(candidate.rounds)
  );
}

/* ── Decorative leaf image ────────────────────────────────────────── */
function Leaf({
  style,
  className,
  flip,
  size = 28,
}: {
  style?: React.CSSProperties;
  className?: string;
  flip?: boolean;
  size?: number;
}) {
  return (
    <img
      src="/leaves.png"
      alt=""
      width={size}
      height={size}
      className={`pixel-crisp ${className ?? ""}`}
      style={{
        ...style,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
}

/* ── Twinkling star ──────────────────────────────────────────────── */
function Star({
  x,
  y,
  delay,
  size = 3,
}: {
  x: string;
  y: string;
  delay: number;
  size?: number;
}) {
  return (
    <motion.div
      className="absolute"
      style={{ left: x, top: y }}
      animate={{ opacity: [0.15, 1, 0.15], scale: [0.7, 1.3, 0.7] }}
      transition={{
        duration: 2.5 + Math.random() * 2,
        repeat: Number.POSITIVE_INFINITY,
        delay,
        ease: "easeInOut",
      }}
    >
      {/* Four-pointed star shape */}
      <svg width={size * 4} height={size * 4} viewBox="0 0 16 16">
        <path
          d="M8 0 L9 6 L16 8 L9 10 L8 16 L7 10 L0 8 L7 6 Z"
          fill="#FFF"
          opacity="0.9"
        />
      </svg>
    </motion.div>
  );
}

/* ── Pixel-art cloud (multi-blob) ────────────────────────────────── */
function PixelCloud({
  y,
  delay,
  duration,
  scale = 1,
}: {
  y: string;
  delay: number;
  duration: number;
  scale?: number;
}) {
  const w = 160 * scale;
  const h = 60 * scale;
  return (
    <motion.div
      className="absolute"
      style={{ top: y }}
      initial={{ left: `-${w}px` }}
      animate={{ left: "110%" }}
      transition={{
        duration,
        repeat: Number.POSITIVE_INFINITY,
        delay,
        ease: "linear",
      }}
    >
      <svg
        width={w}
        height={h}
        viewBox="0 0 160 60"
        fill="none"
        className="pixel-crisp"
      >
        {/* Main body */}
        <rect
          x="20"
          y="24"
          width="120"
          height="28"
          rx="14"
          fill="white"
          opacity="0.92"
        />
        {/* Top bumps */}
        <ellipse cx="55" cy="22" rx="28" ry="20" fill="white" opacity="0.92" />
        <ellipse cx="95" cy="18" rx="24" ry="18" fill="white" opacity="0.92" />
        <ellipse cx="120" cy="26" rx="18" ry="14" fill="white" opacity="0.92" />
        <ellipse cx="35" cy="30" rx="16" ry="12" fill="white" opacity="0.92" />
        {/* Highlight */}
        <ellipse cx="60" cy="16" rx="16" ry="10" fill="white" opacity="0.35" />
        {/* Shadow underside */}
        <rect
          x="28"
          y="40"
          width="104"
          height="10"
          rx="5"
          fill="#C8DFF0"
          opacity="0.35"
        />
      </svg>
    </motion.div>
  );
}

export default function Home() {
  const [showIntro, setShowIntro] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIntroComplete = useCallback(() => {
    setShowIntro(false);
  }, []);

  const handlePlay = useCallback(() => {
    setShowEditor(true);
  }, []);

  const handleLoadFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string) as SavedSimulation;
          if (!isSavedSimulation(parsed)) {
            console.error("Invalid simulation file");
            return;
          }
          setReplayData(parsed);
          router.push("/simulate?mode=replay&map=citypack");
        } catch (err) {
          console.error("Failed to parse simulation file:", err);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [router],
  );

  return (
    <AnimatePresence mode="wait">
      {showIntro ? (
        <IntroAnimation key="intro" onComplete={handleIntroComplete} />
      ) : (
        <motion.div
          key="title-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="relative flex h-screen flex-col items-center justify-center overflow-hidden"
        >
          {/* ── Background ──────────────────────────────────────── */}
          <Image
            src="/background.png"
            alt=""
            fill
            priority
            className="object-cover object-bottom pixel-crisp"
            style={{ zIndex: 0 }}
          />

          {/* ── Twinkling stars ──────────────────────────────────── */}
          <div className="absolute inset-0 z-[1] pointer-events-none">
            <Star x="12%" y="6%" delay={0} size={3} />
            <Star x="28%" y="4%" delay={0.8} size={2} />
            <Star x="50%" y="2%" delay={1.5} size={4} />
            <Star x="70%" y="5%" delay={0.3} size={2} />
            <Star x="85%" y="3%" delay={1.1} size={3} />
            <Star x="18%" y="12%" delay={2.0} size={2} />
            <Star x="78%" y="10%" delay={0.6} size={3} />
            <Star x="40%" y="8%" delay={1.8} size={2} />
            <Star x="92%" y="7%" delay={0.4} size={2} />
            <Star x="6%" y="15%" delay={1.3} size={3} />
          </div>

          {/* ── Drifting pixel clouds ───────────────────────────── */}
          <div className="absolute inset-0 z-[2] pointer-events-none overflow-hidden">
            <PixelCloud y="22%" delay={0} duration={80} scale={1.4} />
            <PixelCloud y="32%" delay={15} duration={100} scale={1.0} />
            <PixelCloud y="18%" delay={35} duration={90} scale={1.2} />
            <PixelCloud y="38%" delay={55} duration={110} scale={0.8} />
            <PixelCloud y="26%" delay={45} duration={95} scale={1.1} />
          </div>

          {/* ── Wooden Sign Title ────────────────────────────────── */}
          <motion.div
            initial={{ y: -60, opacity: 0, rotate: -2 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={{
              delay: 0.3,
              duration: 1.2,
              type: "spring",
              stiffness: 80,
              damping: 12,
            }}
            className="relative z-[10] mb-10"
          >
            {/* Sign board — pixelated */}
            <div
              className="relative px-14 py-8 text-center pixel-crisp"
              style={{
                background: "#D4A044",
                border: "6px solid #5B3010",
                borderRadius: "2px",
                boxShadow:
                  "inset 4px 4px 0 #E8C874, inset -4px -4px 0 #A07028, 6px 6px 0 #3D1E08",
                minWidth: "520px",
                imageRendering: "pixelated",
              }}
            >
              {/* Wood grain lines — hard pixel steps */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, transparent, transparent 12px, #C08830 12px, #C08830 14px, transparent 14px, transparent 26px, #B87C30 26px, #B87C30 28px)",
                  opacity: 0.25,
                }}
              />

              {/* Corner nails — hard pixel squares */}
              {[
                { top: 10, left: 10 },
                { top: 10, right: 10 },
                { bottom: 10, left: 10 },
                { bottom: 10, right: 10 },
              ].map((pos, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    ...pos,
                    width: 8,
                    height: 8,
                    background: "#A8A8A8",
                    border: "2px solid #707070",
                    borderRadius: "1px",
                    boxShadow: "1px 1px 0 #404040",
                  }}
                />
              ))}

              {/* Decorative leaves */}
              <Leaf
                className="absolute"
                style={{ top: -12, left: -10, rotate: "-15deg" }}
                size={32}
              />
              <Leaf
                className="absolute"
                style={{ top: -10, right: -12, rotate: "20deg" }}
                size={30}
                flip
              />
              <Leaf
                className="absolute"
                style={{ bottom: 4, left: 36, rotate: "-30deg" }}
                size={24}
              />
              <Leaf
                className="absolute"
                style={{ bottom: -8, right: 50, rotate: "10deg" }}
                size={22}
                flip
              />

              {/* Title text */}
              <motion.h1
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.6, type: "spring" }}
                className="relative z-10 text-[36px] font-pixel uppercase leading-tight tracking-wider"
                style={{
                  color: "#5B3010",
                  textShadow: "3px 3px 0 #C89038, -1px -1px 0 #7A4E1E",
                }}
              >
                Simulacra
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.8 }}
                className="relative z-10 mt-2 text-[9px] font-pixel uppercase tracking-[0.25em]"
                style={{ color: "#7A4E1E" }}
              >
                Policy Simulator
              </motion.p>
            </div>

            {/* Rope hangers — pixel style */}
            <div
              className="absolute -top-6 left-[20%] w-[4px] h-8"
              style={{ background: "#6B4226", boxShadow: "1px 0 0 #8B6914" }}
            />
            <div
              className="absolute -top-6 right-[20%] w-[4px] h-8"
              style={{ background: "#6B4226", boxShadow: "1px 0 0 #8B6914" }}
            />
          </motion.div>

          {/* ── Menu Buttons (Play + Load) ───────────────────────── */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.0, duration: 0.8 }}
            className="relative z-[10] flex gap-5"
          >
            {/* PLAY button — pixelated */}
            <motion.button
              type="button"
              onClick={handlePlay}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              whileHover={{ y: -3 }}
              whileTap={{ y: 2 }}
              className="flex flex-col items-center gap-2 px-8 py-5 cursor-pointer pixel-crisp"
              style={{
                background: "#D4A044",
                border: "4px solid #5B3010",
                borderRadius: "2px",
                boxShadow:
                  "inset 3px 3px 0 #E8C874, inset -3px -3px 0 #A07028, 4px 4px 0 #3D1E08",
                minWidth: "120px",
              }}
            >
              <span className="text-[20px]" style={{ color: "#5B3010" }}>
                {"\u25B6"}
              </span>
              <span
                className="text-[11px] font-pixel uppercase tracking-wide"
                style={{
                  color: "#5B3010",
                  textShadow: "2px 2px 0 #C89038",
                }}
              >
                Play
              </span>
            </motion.button>

            {/* LOAD button — pixelated */}
            <motion.button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.35, duration: 0.5 }}
              whileHover={{ y: -3 }}
              whileTap={{ y: 2 }}
              className="flex flex-col items-center gap-2 px-8 py-5 cursor-pointer pixel-crisp"
              style={{
                background: "#D4A044",
                border: "4px solid #5B3010",
                borderRadius: "2px",
                boxShadow:
                  "inset 3px 3px 0 #E8C874, inset -3px -3px 0 #A07028, 4px 4px 0 #3D1E08",
                minWidth: "120px",
              }}
            >
              <span className="text-[20px]" style={{ color: "#5B3010" }}>
                {"\uD83D\uDCC2"}
              </span>
              <span
                className="text-[11px] font-pixel uppercase tracking-wide"
                style={{
                  color: "#5B3010",
                  textShadow: "2px 2px 0 #C89038",
                }}
              >
                Load
              </span>
            </motion.button>
          </motion.div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleLoadFile}
            className="hidden"
          />

          {/* ── Version badge ────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0, duration: 1.0 }}
            className="absolute bottom-4 right-4 z-[10]"
          >
            <span
              className="text-[8px] font-pixel uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              v1.0 {"\u2014"} The Boys Inc.
            </span>
          </motion.div>

          {/* ── Node editor overlay ─────────────────────────────── */}
          <AnimatePresence>
            {showEditor && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="fixed inset-0 z-[50] flex flex-col"
              >
                <Image
                  src="/background.png"
                  alt=""
                  fill
                  className="object-cover object-bottom"
                  style={{ zIndex: 0 }}
                />
                <div
                  className="absolute inset-0 z-[1]"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(10,30,15,0.6) 0%, rgba(10,30,15,0.4) 40%, rgba(10,30,15,0.55) 100%)",
                  }}
                />
                <div
                  className="relative z-[10] flex h-10 shrink-0 items-center justify-between px-5"
                  style={{
                    background: "rgba(232,213,163,0.92)",
                    borderBottom: "3px solid #6B4226",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowEditor(false)}
                    className="text-[9px] font-pixel uppercase tracking-wide transition-opacity hover:opacity-70"
                    style={{ color: "#7A4E1E" }}
                  >
                    {"\u2190"} Back
                  </button>
                  <span
                    className="text-[9px] font-pixel tracking-wide"
                    style={{ color: "#3D2510" }}
                  >
                    {"\u2605"} New Simulation
                  </span>
                  <span
                    className="text-[8px] font-pixel"
                    style={{ color: "#3E7C34" }}
                  >
                    {"\u2605"} Ready
                  </span>
                </div>
                <div className="relative z-[10] flex-1">
                  <NodeCanvasClient
                    onSimulateStart={() => setShowLoading(true)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Loading screen ───────────────────────────────────── */}
          <SimLoadingScreen isVisible={showLoading} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
