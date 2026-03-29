"use client";

interface ChatBubbleProps {
  agentName: string;
  agentCategory?: string;
  message: string;
  x: number;
  y: number;
}

const BUBBLE_STEM_LENGTH = 14;

export function ChatBubble({
  agentName,
  agentCategory,
  message,
  x,
  y,
}: ChatBubbleProps) {
  return (
    <div
      className="pointer-events-none absolute z-30 will-change-[left,top]"
      style={{ left: x, top: y }}
      data-testid="chat-bubble"
    >
      <div className="absolute left-0 bottom-0 w-max max-w-[180px] -translate-x-1/2">
        <div className="flex flex-col items-center">
          <div className="animate-[fadeInUp_0.3s_ease-out]">
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
          <div className="-mt-px h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-white/10" />
          <div className="-mt-[8px] h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-black/80" />
          <div
            className="w-px bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.15)]"
            style={{ height: BUBBLE_STEM_LENGTH }}
          />
        </div>
      </div>
    </div>
  );
}
