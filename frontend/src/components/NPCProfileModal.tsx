"use client";

import { useEffect } from "react";
import type { BackendNPC } from "@/types/backend";

interface NPCProfileModalProps {
  npc: BackendNPC;
  onClose: () => void;
  onOpenChat?: (npc: BackendNPC) => void;
}

const MOOD_COLOR: Record<string, string> = {
  angry: "#B83A52",
  anxious: "#C97D1A",
  worried: "#C97D1A",
  neutral: "#5A8DB8",
  hopeful: "#3E7C34",
  excited: "#7B68EE",
};

const INCOME_LABEL: Record<string, { text: string; color: string }> = {
  low: { text: "LOW", color: "#B83A52" },
  medium: { text: "MED", color: "#C97D1A" },
  high: { text: "HIGH", color: "#3E7C34" },
};

function politicalLabel(v: number): string {
  if (v <= -0.6) return "strongly progressive";
  if (v <= -0.2) return "leaning progressive";
  if (v <= 0.2) return "moderate";
  if (v <= 0.6) return "leaning conservative";
  return "strongly conservative";
}

function politicalColor(v: number): string {
  if (v <= -0.4) return "#5A8DB8";
  if (v <= 0.4) return "#7B68EE";
  return "#B83A52";
}

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
  glowClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-[3px]">
      <span
        className="text-[9px] font-mono uppercase tracking-widest"
        style={{ color: "#A0824A" }}
      >
        {label}
      </span>
      <span
        className="text-[10px] font-mono font-bold"
        style={{ color: valueColor ?? "#3D2510" }}
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
    <div className="px-3 py-2" style={{ borderTop: "1px solid #E8D5A3" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[10px] font-mono" style={{ color: "#C4A46C" }}>
          {symbol}
        </span>
        <span
          className="text-[8px] font-pixel uppercase"
          style={{ color: "#A0824A" }}
        >
          {label}
        </span>
      </div>
      <p
        className={`text-[10px] font-mono leading-relaxed ${hasContent ? "italic" : ""}`}
        style={{ color: hasContent ? "#6B4C2A" : "#C4A46C" }}
      >
        {hasContent ? `"${content}"` : fallback}
      </p>
    </div>
  );
}

export function NPCProfileModal({ npc, onClose, onOpenChat }: NPCProfileModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const moodColor = MOOD_COLOR[npc.mood] ?? "#8B7355";
  const income = INCOME_LABEL[npc.income_level] ?? INCOME_LABEL.medium;
  const polLabel = politicalLabel(npc.political_leaning);
  const polColor = politicalColor(npc.political_leaning);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-[320px] max-h-[80vh] overflow-y-auto scrollbar-thin animate-[modalIn_150ms_ease-out]"
        style={{
          background: "#F5E6C8",
          border: "4px solid #6B4226",
          borderRadius: "8px",
          boxShadow:
            "inset 2px 2px 0 rgba(196,164,108,.55), inset -2px -2px 0 rgba(61,37,16,.25), 4px 4px 0 rgba(61,37,16,.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-3 py-3"
          style={{ background: "#E8D5A3", borderBottom: "2px solid #C4A46C" }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-mono"
                style={{ color: "#A0824A" }}
              >
                {">>"}
              </span>
              <h2
                className="text-[9px] font-pixel uppercase tracking-wide truncate"
                style={{ color: "#5B3A1E" }}
              >
                {npc.name}
              </h2>
            </div>
            <div
              className="mt-1 ml-5 text-[9px] font-mono uppercase tracking-widest"
              style={{ color: "#8B7355" }}
            >
              {npc.profession || npc.role?.replace(/_/g, " ") || "Resident"} · {npc.mbti} · {npc.industry || "Millfield"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] font-mono px-1 -mr-1 uppercase transition-opacity hover:opacity-60"
            style={{ color: "#8B7355" }}
          >
            [{"\u00D7"}]
          </button>
        </div>

        {/* Stats */}
        <div
          className="px-3 py-2"
          style={{ background: "#EDE4D3", borderBottom: "1px solid #E8D5A3" }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="text-[10px] font-mono"
              style={{ color: "#D4A520" }}
            >
              {"\u2605"}
            </span>
            <span
              className="text-[8px] font-pixel uppercase"
              style={{ color: "#A0824A" }}
            >
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
              label="Reputation"
              value={`${(npc.reputation * 100).toFixed(0)}%`}
              valueColor="#2dd4bf"
              glowClass="neon-text-teal"
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
            <StatRow label="Position" value={`(${npc.x}, ${npc.y})`} />
          </div>
        </div>

        {/* Internal state sections */}
        <SectionBlock
          label="Perception"
          symbol="?"
          content={npc.perception}
          fallback="No thoughts yet..."
        />
        <SectionBlock
          label="Beliefs"
          symbol="!"
          content={npc.beliefs?.join(" · ")}
          fallback="No defined beliefs..."
        />
        <SectionBlock
          label="Controversial Ideas"
          symbol="*"
          content={npc.controversial_ideas?.join(" · ")}
          fallback="No controversial ideas..."
        />
        <SectionBlock
          label="Plan"
          symbol=">"
          content={npc.current_plan}
          fallback="No plan formed yet..."
        />

        {/* Footer bar */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ background: "#E8D5A3", borderTop: "2px solid #C4A46C" }}
        >
          <span
            className="text-[9px] font-mono uppercase tracking-tight"
            style={{ color: "#A0824A" }}
          >
            {npc.id} · ESC TO CLOSE
          </span>
          {onOpenChat && (
            <button
              type="button"
              onClick={() => onOpenChat(npc)}
              className="px-3 py-1 text-[9px] font-pixel uppercase tracking-wide transition-opacity hover:opacity-80"
              style={{
                background: "#3E7C34",
                border: "2px solid #2A5424",
                borderRadius: "4px",
                color: "#FDF5E6",
                boxShadow: "inset 1px 1px 0 #5A9B4A, 2px 2px 0 #1A3414",
              }}
            >
              Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
