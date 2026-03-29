"use client";

interface ChatBubbleProps {
  agentName: string;
  agentCategory?: string;
  message: string;
  x: number;
  y: number;
}

export function ChatBubble({
  agentName,
  agentCategory,
  message,
  x,
  y,
}: ChatBubbleProps) {
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-[180px] -translate-x-1/2 -translate-y-full animate-[fadeInUp_0.3s_ease-out] transition-[left,top] duration-100 ease-linear"
      style={{ left: x, top: y - 8 }}
      data-testid="chat-bubble"
    >
      <div
        className="rpg-panel px-2.5 py-1.5"
        style={{ background: "#FDF5E6", border: "2px solid #A0824A" }}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-[8px] font-pixel" style={{ color: "#5B3A1E" }}>
            {agentName}
          </span>
          {agentCategory && (
            <span className="text-[7px] font-mono" style={{ color: "#A0824A" }}>
              {agentCategory}
            </span>
          )}
        </div>
        <p
          className="mt-1 text-[10px] font-mono leading-snug"
          style={{ color: "#6B4C2A" }}
        >
          {message.length > 80 ? `${message.slice(0, 80)}...` : message}
        </p>
      </div>
      {/* Speech bubble tail pointing down to NPC */}
      <div className="flex flex-col items-center">
        <div
          className="h-0 w-0 border-x-[8px] border-t-[10px] border-x-transparent"
          style={{ borderTopColor: "#A0824A" }}
        />
        <div
          className="-mt-[11px] h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent"
          style={{ borderTopColor: "#FDF5E6" }}
        />
        <div className="h-3 w-[2px]" style={{ background: "#C4A46C" }} />
        <div
          className="h-[4px] w-[4px] rounded-full"
          style={{
            background: "#D4A520",
            boxShadow: "0 0 4px rgba(212,165,32,0.5)",
          }}
        />
      </div>
    </div>
  );
}
