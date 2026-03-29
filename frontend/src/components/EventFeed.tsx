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
      return "text-white/40";
    case "price_change":
      return "text-yellow-400 neon-text-yellow";
    case "layoff":
      return "text-pink-500 neon-text-pink";
    case "protest":
      return "text-orange-400 neon-text-yellow";
    case "closure":
      return "text-pink-600 neon-text-pink";
    case "strike":
      return "text-yellow-500 neon-text-yellow";
    case "policy_response":
      return "text-teal-400 neon-text-teal";
    case "phase_change":
      return "text-purple-400 neon-text-purple";
    default:
      return "text-white/20";
  }
}

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
          <div className="flex h-full items-center justify-center text-[10px] font-mono text-white/10 uppercase tracking-widest">
            Awaiting simulation...
          </div>
        )}

        {events.map((event) => {
          if (event.type === "phase_change") {
            return (
              <div
                key={event.id}
                className="my-2 border-y border-white/5 py-1.5 text-center text-[8px] font-pixel text-purple-400 neon-text-purple"
                data-testid="phase-marker"
              >
                {event.message}
              </div>
            );
          }

          return (
            <div
              key={event.id}
              className={`mb-1 px-2 py-1.5 rounded border border-transparent ${onEventClick ? "cursor-pointer hover:bg-white/5 hover:border-white/5 transition-colors" : ""}`}
              data-testid="event-item"
              onClick={onEventClick ? () => onEventClick(event) : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-mono ${eventAccent(event.type)}`}
                >
                  {eventIcon(event.type)}
                </span>
                <span className="text-[10px] font-mono font-bold text-white/90 neon-text-white">
                  {event.agentName}
                </span>
                <span className="ml-auto text-[9px] font-mono tabular-nums text-white/20">
                  M{event.month}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] font-mono leading-relaxed text-white/40">
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
