"use client";

import { useEffect } from "react";
import type { BackendNPC } from "@/types/backend";

interface NPCProfileModalProps {
  npc: BackendNPC;
  onClose: () => void;
}

const MOOD_COLOR: Record<string, string> = {
  angry: "#d45050",
  anxious: "#e87840",
  worried: "#e8a43a",
  neutral: "#8a7a62",
  hopeful: "#5ab85a",
  excited: "#50a0d4",
};

const INCOME_LABEL: Record<string, { text: string; color: string }> = {
  low: { text: "LOW", color: "#d45050" },
  medium: { text: "MED", color: "#e8a43a" },
  high: { text: "HIGH", color: "#5ab85a" },
};

function politicalLabel(v: number): string {
  if (v <= -0.6) return "strongly progressive";
  if (v <= -0.2) return "leaning progressive";
  if (v <= 0.2) return "moderate";
  if (v <= 0.6) return "leaning conservative";
  return "strongly conservative";
}

function politicalColor(v: number): string {
  if (v <= -0.4) return "#50a0d4";
  if (v <= 0.4) return "#8a7a62";
  return "#d45050";
}

function StatRow({
  label,
  value,
  valueColor,
}: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between py-[3px]">
      <span className="text-[10px] font-mono uppercase text-[#5a4a32]">
        {label}
      </span>
      <span
        className="text-[10px] font-mono font-bold"
        style={{ color: valueColor ?? "#c4b490" }}
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
}: { label: string; symbol: string; content?: string; fallback: string }) {
  const hasContent = content && content.trim().length > 0;
  return (
    <div className="border-t border-[#3a2e1e] px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-mono text-[#5a4a32]">{symbol}</span>
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#5a4a32]">
          {label}
        </span>
      </div>
      <p
        className={`text-[10px] font-mono leading-relaxed ${hasContent ? "text-[#c4b490] italic" : "text-[#4a3c2a]"}`}
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Panel */}
      <div
        className="rpg-panel relative z-10 w-[320px] max-h-[80vh] overflow-y-auto scrollbar-thin animate-[modalIn_150ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#3a2e1e] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#5a4a32]">
                {">>"}
              </span>
              <h2 className="text-[11px] font-mono font-bold uppercase tracking-wide text-[#e8a43a] truncate">
                {npc.name}
              </h2>
            </div>
            <div className="mt-0.5 ml-5 text-[10px] font-mono text-[#8a7a62]">
              {npc.role?.replace(/_/g, " ")} · {npc.industry || "Millfield"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-mono text-[#5a4a32] hover:text-[#e8a43a] transition-colors px-1 -mr-1"
          >
            [x]
          </button>
        </div>

        {/* Stats */}
        <div className="px-3 py-1.5 border-b border-[#3a2e1e]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-[#5a4a32]">*</span>
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#5a4a32]">
              Status
            </span>
          </div>
          <div className="ml-3">
            <StatRow
              label="Mood"
              value={npc.mood.toUpperCase()}
              valueColor={moodColor}
            />
            <StatRow
              label="Income"
              value={income.text}
              valueColor={income.color}
            />
            <StatRow
              label="Political"
              value={`${npc.political_leaning > 0 ? "+" : ""}${npc.political_leaning.toFixed(1)} ${polLabel}`}
              valueColor={polColor}
            />
            {npc.personality && (
              <StatRow label="Type" value={npc.personality} />
            )}
            <StatRow
              label="Position"
              value={`(${npc.x}, ${npc.y})`}
            />
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
        <div className="border-t border-[#3a2e1e] px-3 py-1.5">
          <span className="text-[9px] font-mono text-[#3a2e1e]">
            {npc.id} · click outside or [esc] to close
          </span>
        </div>
      </div>
    </div>
  );
}
