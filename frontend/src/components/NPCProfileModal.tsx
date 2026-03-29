"use client";

import { useEffect } from "react";
import type { BackendNPC } from "@/types/backend";

interface NPCProfileModalProps {
  npc: BackendNPC;
  onClose: () => void;
}

const MOOD_COLOR: Record<string, string> = {
  angry: "#f472b6",   // Pink
  anxious: "#fbbf24", // Yellow
  worried: "#facc15", // Neon Yellow
  neutral: "#818cf8", // Indigo
  hopeful: "#2dd4bf", // Teal
  excited: "#a855f7", // Purple
};

const INCOME_LABEL: Record<string, { text: string; color: string }> = {
  low: { text: "LOW", color: "#f472b6" },
  medium: { text: "MED", color: "#facc15" },
  high: { text: "HIGH", color: "#2dd4bf" },
};

function politicalLabel(v: number): string {
  if (v <= -0.6) return "strongly progressive";
  if (v <= -0.2) return "leaning progressive";
  if (v <= 0.2) return "moderate";
  if (v <= 0.6) return "leaning conservative";
  return "strongly conservative";
}

function politicalColor(v: number): string {
  if (v <= -0.4) return "#2dd4bf";
  if (v <= 0.4) return "#818cf8";
  return "#f472b6";
}

function politicalGlow(v: number): string {
  if (v <= -0.4) return "neon-text-teal";
  if (v <= 0.4) return "neon-text-indigo";
  return "neon-text-pink";
}

function StatRow({
  label,
  value,
  valueColor,
  glowClass,
}: {
  label: string;
  value: string;
  valueColor?: string;
  glowClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-[3px]">
      <span className="text-[9px] font-mono uppercase tracking-widest text-white/40">
        {label}
      </span>
      <span
        className={`text-[10px] font-mono font-bold ${glowClass || ""}`}
        style={{ color: valueColor ?? "rgba(255,255,255,0.9)" }}
      >
        {value}
      </span>
    </div>
  );
}

function SectionBlock({
  label,
  symbol,
  content,
  fallback,
}: {
  label: string;
  symbol: string;
  content?: string;
  fallback: string;
}) {
  const hasContent = content && content.trim().length > 0;
  return (
    <div className="border-t border-white/5 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-mono text-white/20">{symbol}</span>
        <span className="text-[8px] font-pixel uppercase text-purple-400/60">
          {label}
        </span>
      </div>
      <p
        className={`text-[10px] font-mono leading-relaxed ${hasContent ? "text-white/80 italic" : "text-white/20"}`}
      >
        {hasContent ? `"${content}"` : fallback}
      </p>
    </div>
  );
}

export function NPCProfileModal({ npc, onClose }: NPCProfileModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const moodColor = MOOD_COLOR[npc.mood] ?? "#8a7a62";
  const income = INCOME_LABEL[npc.income_level] ?? INCOME_LABEL.medium;
  const polLabel = politicalLabel(npc.political_leaning);
  const polColor = politicalColor(npc.political_leaning);
  const polGlow = politicalGlow(npc.political_leaning);

  const moodGlow = npc.mood === 'angry' ? 'neon-text-pink' : 
                   (npc.mood === 'anxious' || npc.mood === 'worried') ? 'neon-text-yellow' :
                   npc.mood === 'hopeful' ? 'neon-text-teal' :
                   npc.mood === 'excited' ? 'neon-text-purple' : 'neon-text-indigo';

  const incomeGlow = npc.income_level === 'low' ? 'neon-text-pink' :
                     npc.income_level === 'medium' ? 'neon-text-yellow' : 'neon-text-teal';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Panel */}
      <div
        className="rpg-panel relative z-10 w-[320px] max-h-[80vh] overflow-y-auto scrollbar-thin animate-[modalIn_150ms_ease-out] bg-[#060010] border-white/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/5 px-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-purple-500/50">
                {">>"}
              </span>
              <h2 className="text-[9px] font-pixel uppercase tracking-wide text-purple-400 truncate neon-text-purple">
                {npc.name}
              </h2>
            </div>
            <div className="mt-1 ml-5 text-[9px] font-mono text-white/40 uppercase tracking-widest">
              {npc.role?.replace(/_/g, " ")} · {npc.industry || "Millfield"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-mono text-white/20 hover:text-white/60 transition-colors px-1 -mr-1 uppercase"
          >
            [x]
          </button>
        </div>

        {/* Stats */}
        <div className="px-3 py-2 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-white/20">*</span>
            <span className="text-[8px] font-pixel uppercase text-purple-400/60">
              Status
            </span>
          </div>
          <div className="ml-3">
            <StatRow
              label="Mood"
              value={npc.mood.toUpperCase()}
              valueColor={moodColor}
              glowClass={moodGlow}
            />
            <StatRow
              label="Income"
              value={income.text}
              valueColor={income.color}
              glowClass={incomeGlow}
            />
            <StatRow
              label="Political"
              value={`${npc.political_leaning > 0 ? "+" : ""}${npc.political_leaning.toFixed(1)} ${polLabel}`}
              valueColor={polColor}
              glowClass={polGlow}
            />
            {npc.personality && (
              <StatRow label="Type" value={npc.personality} />
            )}
            <StatRow label="Position" value={`(${npc.x}, ${npc.y})`} />
          </div>
        </div>

        {/* Internal state sections */}
        <SectionBlock
          label="Thinking"
          symbol="?"
          content={npc.perception}
          fallback="No thoughts yet..."
        />
        <SectionBlock
          label="Feeling"
          symbol="~"
          content={npc.emotional_reaction}
          fallback="No feelings recorded yet..."
        />
        <SectionBlock
          label="Plan"
          symbol=">"
          content={npc.current_plan}
          fallback="No plan formed yet..."
        />

        {/* Footer bar */}
        <div className="border-t border-white/5 px-3 py-2 bg-black/40">
          <span className="text-[9px] font-mono text-white/20 uppercase tracking-tight">
            {npc.id} · ESC TO CLOSE
          </span>
        </div>
      </div>
    </div>
  );
}
