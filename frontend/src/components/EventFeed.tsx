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
      return "text-[#a89878]";
    case "price_change":
      return "text-[#e8a43a]";
    case "layoff":
      return "text-[#d45050]";
    case "protest":
      return "text-[#e87840]";
    case "closure":
      return "text-[#c43030]";
    case "strike":
      return "text-[#e8c840]";
    case "policy_response":
      return "text-[#50a0d4]";
    case "phase_change":
      return "text-[#e8a43a]";
    default:
      return "text-[#8a7a62]";
  }
}

function eventBorderClass(type: SimEvent["type"]): string {
  switch (type) {
    case "protest":
      return "event-border-protest";
    case "strike":
      return "event-border-strike";
    case "closure":
      return "event-border-closure";
    case "layoff":
      return "event-border-layoff";
    case "price_change":
      return "event-border-price";
    case "reaction":
      return "event-border-reaction";
    case "policy_response":
      return "event-border-policy";
    default:
      return "event-border-default";
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
          <div className="flex h-full items-center justify-center text-[10px] font-mono text-[#5a4a32]">
            Awaiting simulation...
          </div>
        )}

        {events.map((event) => {
          if (event.type === "phase_change") {
            return (
              <div
                key={event.id}
                className="my-2 border-y border-[#4a3c2a] bg-[#1e1812] py-2 text-center text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#e8a43a]"
                style={{ textShadow: "0 0 8px rgba(232,164,58,0.3)" }}
                data-testid="phase-marker"
              >
                {event.message}
              </div>
            );
          }

          return (
            <div
              key={event.id}
              className={`mb-1 pl-2.5 pr-2 py-1.5 ${eventBorderClass(event.type)} transition-all duration-150 ${onEventClick ? "cursor-pointer hover:bg-[#1e1812] hover:pl-3" : ""}`}
              data-testid="event-item"
              onClick={onEventClick ? () => onEventClick(event) : undefined}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-mono ${eventAccent(event.type)}`}
                >
                  {eventIcon(event.type)}
                </span>
                <span className="text-[10px] font-mono font-bold text-[#c4b490]">
                  {event.agentName}
                </span>
                <span className="ml-auto text-[8px] font-mono uppercase tracking-wider tabular-nums text-[#4a3c2a]">
                  M{event.month}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] font-mono leading-relaxed text-[#8a7a62]">
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
