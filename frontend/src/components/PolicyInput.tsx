"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MapType } from "@/game/config";
import { POLICY_PRESETS } from "@/mocks/mockData";
import { startSimulation } from "@/services/wsClient";

const MAP_OPTIONS: { id: MapType; label: string; desc: string }[] = [
  { id: "ccity", label: "CCity", desc: "Large 80x60 modern city" },
  { id: "pico8", label: "Pico-8 City", desc: "Compact 55x30 retro town" },
  { id: "citypack", label: "Citypack", desc: "Infinite procedural city" },
];

export function PolicyInput() {
  const [text, setText] = useState("");
  const [mapId, setMapId] = useState<MapType>("ccity");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSimulate() {
    if (text.trim().length < 20 || loading) return;
    setLoading(true);
    try {
      const simId = await startSimulation(text);
      router.push(`/simulate?id=${simId}&map=${mapId}`);
    } catch (err) {
      console.error("Failed to start simulation:", err);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="policy-input">
      {/* Map selector */}
      <div data-testid="map-selector">
        <p className="mb-2 text-[10px] font-mono tracking-widest uppercase text-[#6a5a42]">
          Select Map
        </p>
        <div className="flex gap-3">
          {MAP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMapId(opt.id)}
              data-testid={`map-${opt.id}`}
              className={`rpg-panel flex-1 px-4 py-3 text-left transition-colors duration-150 active:translate-y-px ${
                mapId === opt.id
                  ? "border-[#e8a43a] bg-[#2a2218] shadow-[0_0_8px_rgba(232,164,58,0.15)]"
                  : "hover:border-[#6a5a42]"
              }`}
            >
              <span
                className={`block text-sm font-mono font-bold ${
                  mapId === opt.id ? "text-[#e8a43a]" : "text-[#d4c4a0]"
                }`}
              >
                {opt.label}
              </span>
              <span className="block mt-0.5 text-[10px] font-mono text-[#8a7a62]">
                {opt.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

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
        disabled={text.trim().length < 20 || loading}
        suppressHydrationWarning
        data-testid="simulate-button"
        className="rpg-panel w-full px-6 py-3 text-sm font-mono font-bold text-[#e8a43a] transition-all duration-150 hover:bg-[#2a2218] hover:border-[#e8a43a] hover:shadow-[0_0_8px_rgba(232,164,58,0.2)] disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-px"
      >
        {loading ? ">> Starting... <<" : ">> Run Simulation <<"}
      </button>
    </div>
  );
}
