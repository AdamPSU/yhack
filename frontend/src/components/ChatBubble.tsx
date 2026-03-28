"use client";

interface ChatBubbleProps {
  agentName: string;
  message: string;
  x: number;
  y: number;
}

export function ChatBubble({ agentName, message, x, y }: ChatBubbleProps) {
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-[180px] -translate-x-1/2 -translate-y-full animate-[fadeInUp_0.3s_ease-out] transition-[left,top] duration-100 ease-linear"
      style={{ left: x, top: y - 8 }}
      data-testid="chat-bubble"
    >
      <div className="rpg-panel px-2.5 py-1.5">
        <div className="text-[9px] font-mono font-bold text-[#e8a43a]">
          {agentName}
        </div>
        <p className="mt-0.5 text-[10px] font-mono leading-snug text-[#c4b490]">
          {message.length > 80 ? `${message.slice(0, 80)}...` : message}
        </p>
      </div>
      {/* Speech bubble tail pointing down to NPC */}
      <div className="flex flex-col items-center">
        <div className="h-0 w-0 border-x-[8px] border-t-[10px] border-x-transparent border-t-[#4a3c2a]" />
        <div className="-mt-[11px] h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-[#251e15]" />
        <div className="h-3 w-[2px] bg-[#4a3c2a]" />
        <div className="h-[4px] w-[4px] rounded-full bg-[#e8a43a]" />
      </div>
    </div>
  );
}
