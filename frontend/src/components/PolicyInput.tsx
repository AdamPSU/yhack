"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { POLICY_PRESETS } from "@/mocks/mockData";

export function PolicyInput() {
  const [text, setText] = useState("");
  const router = useRouter();

  function handleSimulate() {
    if (text.trim().length < 20) return;
    sessionStorage.setItem("agora-policy", text);
    router.push("/simulate");
  }

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="policy-input">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2" data-testid="preset-buttons">
        {POLICY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setText(preset.text)}
            data-testid={`preset-${preset.id}`}
            className="rpg-panel px-4 py-2 text-xs font-mono text-[#d4c4a0] transition-colors duration-150 hover:border-[#e8a43a] hover:text-[#e8a43a] active:translate-y-px"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Policy textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe an economic policy in ~500 words..."
          data-testid="policy-textarea"
          rows={8}
          className="rpg-panel w-full resize-none p-4 text-sm leading-relaxed font-mono text-[#d4c4a0] placeholder-[#5a4a32] outline-none transition-colors duration-150 focus:border-[#e8a43a]"
        />
        <span className="absolute right-3 bottom-3 text-[10px] font-mono text-[#5a4a32]">
          {text.length} chars
        </span>
      </div>

      {/* Simulate button */}
      <button
        type="button"
        onClick={handleSimulate}
        disabled={text.trim().length < 20}
        data-testid="simulate-button"
        className="rpg-panel w-full px-6 py-3 text-sm font-mono font-bold text-[#e8a43a] transition-all duration-150 hover:bg-[#2a2218] hover:border-[#e8a43a] hover:shadow-[0_0_8px_rgba(232,164,58,0.2)] disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-px"
      >
        {">> Run Simulation <<"}
      </button>
    </div>
  );
}
