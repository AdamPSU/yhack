"use client";

import { useEffect, useRef } from "react";
import type { SimEvent } from "@/types";

interface EventFeedProps {
  events: SimEvent[];
  onEventClick?: (event: SimEvent) => void;
}

function eventIcon(type: SimEvent["type"]): string {
  switch (type) {
    case "reaction":
      return "\u25B7";
    case "price_change":
      return "\u25B2";
    case "layoff":
      return "\u25A0";
    case "protest":
      return "!";
    case "closure":
      return "\u2716";
    case "strike":
      return "\u26A0";
    case "policy_response":
      return "\u2605";
    case "phase_change":
      return "\u25C6";
    default:
      return "\u25CB";
  }
}

function eventAccent(type: SimEvent["type"]): string {
  switch (type) {
    case "reaction":
      return "sdv-text-muted";
    case "price_change":
      return "sdv-text-gold";
    case "layoff":
      return "sdv-text-berry";
    case "protest":
      return "sdv-text-orange";
    case "closure":
      return "sdv-text-berry";
    case "strike":
      return "sdv-text-orange";
    case "policy_response":
      return "sdv-text-green";
    case "phase_change":
      return "sdv-text-purple";
    default:
      return "sdv-text-muted";
  }
}

// Stardew color classes applied via inline style below
const SDV_COLORS: Record<string, string> = {
  "sdv-text-muted": "#8B7355",
  "sdv-text-gold": "#C97D1A",
  "sdv-text-berry": "#B83A52",
  "sdv-text-orange": "#C97D1A",
  "sdv-text-green": "#3E7C34",
  "sdv-text-purple": "#7B68EE",
};

export function EventFeed({ events, onEventClick }: EventFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="flex h-full flex-col" data-testid="event-feed">
      {/* Events */}
      <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
        {events.length === 0 && (
          <div
            className="flex h-full items-center justify-center text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "#A0824A" }}
          >
            Awaiting simulation...
          </div>
        )}

        {events.map((event) => {
          if (event.type === "phase_change") {
            return (
              <div
                key={event.id}
                className="my-2 py-1.5 text-center text-[8px] font-pixel"
                style={{
                  color: "#5B3A1E",
                  borderTop: "1px solid #C4A46C",
                  borderBottom: "1px solid #C4A46C",
                }}
                data-testid="phase-marker"
              >
                {event.message}
              </div>
            );
          }

          const accentClass = eventAccent(event.type);
          const accentColor = SDV_COLORS[accentClass] ?? "#8B7355";

          return (
            <div
              key={event.id}
              className={`mb-1 px-2 py-1.5 rounded ${onEventClick ? "cursor-pointer transition-colors" : ""}`}
              style={onEventClick ? {} : undefined}
              onMouseEnter={
                onEventClick
                  ? (e) => {
                      (e.currentTarget as HTMLElement).style.background =
                        "rgba(196,164,108,0.15)";
                    }
                  : undefined
              }
              onMouseLeave={
                onEventClick
                  ? (e) => {
                      (e.currentTarget as HTMLElement).style.background = "";
                    }
                  : undefined
              }
              data-testid="event-item"
              onClick={onEventClick ? () => onEventClick(event) : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[10px] font-mono"
                  style={{ color: accentColor }}
                >
                  {eventIcon(event.type)}
                </span>
                <span
                  className="text-[10px] font-mono font-bold"
                  style={{ color: "#3D2510" }}
                >
                  {event.agentName}
                </span>
                {event.agentCategory && (
                  <span
                    className="text-[9px] font-mono"
                    style={{ color: "#A0824A" }}
                  >
                    {event.agentCategory}
                  </span>
                )}
                <span
                  className="ml-auto text-[9px] font-mono tabular-nums"
                  style={{ color: "#A0824A" }}
                >
                  R{event.round}
                </span>
              </div>
              <p
                className="mt-0.5 text-[10px] font-mono leading-relaxed"
                style={{ color: "#6B4C2A" }}
              >
                {event.message}
              </p>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
