"use client";

interface ChatBubbleProps {
  agentName: string;
  agentCategory?: string;
  message: string;
  x: number;
  y: number;
}

const BUBBLE_ANCHOR_LENGTH = 18;

export function ChatBubble({
  agentName,
  agentCategory,
  message,
  x,
  y,
}: ChatBubbleProps) {
  return (
    <div
      className="pointer-events-none absolute z-30 animate-[fadeInUp_0.3s_ease-out] transition-[left,top] duration-100 ease-linear"
      style={{ left: x, top: y }}
      data-testid="chat-bubble"
    >
      <div
        className="absolute left-0 w-max max-w-[180px]"
        style={{
          top: -BUBBLE_ANCHOR_LENGTH,
          transform: "translate(-50%, -100%)",
        }}
      >
        <div className="rpg-panel bg-black/80 px-2.5 py-1.5 border-white/10 backdrop-blur-md">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[8px] font-pixel text-purple-400 neon-text-purple">
              {agentName}
            </span>
            {agentCategory && (
              <span className="text-[7px] font-mono text-white/30">
                {agentCategory}
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] font-mono leading-snug text-white/80">
            {message.length > 80 ? `${message.slice(0, 80)}...` : message}
          </p>
        </div>
      </div>
      <div
        className="absolute left-0 w-px -translate-x-1/2 bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.15)]"
        style={{ top: -BUBBLE_ANCHOR_LENGTH, height: BUBBLE_ANCHOR_LENGTH }}
      />
      <div className="absolute left-0 top-0 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
    </div>
  );
}
