"use client";

type BubbleColor = "orange" | "blue" | "yellow";

const PALETTES: Record<BubbleColor, { border: string; name: string; body: string; tail: string; dot: string }> = {
  orange: { border: "#e8a43a", name: "#e8a43a", body: "#c4b490", tail: "#4a3c2a", dot: "#e8a43a" },
  blue:   { border: "#4a8fe8", name: "#7ab3f5", body: "#b0c8f0", tail: "#2a3c5a", dot: "#4a8fe8" },
  yellow: { border: "#d4a832", name: "#f5d060", body: "#e8d490", tail: "#5a4a1a", dot: "#d4a832" },
};

interface ChatBubbleProps {
  agentName: string;
  message: string;
  x: number;
  y: number;
  color?: BubbleColor;
}

export function ChatBubble({ agentName, message, x, y, color = "orange" }: ChatBubbleProps) {
  const p = PALETTES[color];
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-[180px] -translate-x-1/2 -translate-y-full animate-[fadeInUp_0.3s_ease-out]"
      style={{ left: x, top: y }}
      data-testid="chat-bubble"
    >
      <div className="rpg-panel px-2.5 py-1.5" style={{ borderColor: p.border }}>
        <div className="text-[9px] font-mono font-bold truncate" style={{ color: p.name }}>
          {agentName}
        </div>
        <p className="mt-0.5 text-[10px] font-mono leading-snug" style={{ color: p.body }}>
          {message.length > 80 ? `${message.slice(0, 80)}...` : message}
        </p>
      </div>
      {/* Speech bubble tail pointing down to NPC */}
      <div className="flex flex-col items-center">
        <div className="h-0 w-0 border-x-[8px] border-t-[10px] border-x-transparent" style={{ borderTopColor: p.tail }} />
        <div className="-mt-[11px] h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-[#251e15]" />
        <div className="h-3 w-[2px]" style={{ backgroundColor: p.tail }} />
        <div className="h-[4px] w-[4px] rounded-full" style={{ backgroundColor: p.dot }} />
      </div>
    </div>
  );
}
