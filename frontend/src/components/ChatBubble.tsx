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
      <div className="rpg-panel px-2.5 py-1.5 bg-black/80 border-white/10 backdrop-blur-md">
        <div className="text-[8px] font-pixel text-purple-400 neon-text-purple">
          {agentName}
        </div>
        <p className="mt-1 text-[10px] font-mono leading-snug text-white/80">
          {message.length > 80 ? `${message.slice(0, 80)}...` : message}
        </p>
      </div>
      {/* Speech bubble tail pointing down to NPC */}
      <div className="flex flex-col items-center">
        <div className="h-0 w-0 border-x-[8px] border-t-[10px] border-x-transparent border-t-white/10" />
        <div className="-mt-[11px] h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-black/80" />
        <div className="h-3 w-[2px] bg-white/10" />
        <div className="h-[4px] w-[4px] rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
      </div>
    </div>
  );
}
