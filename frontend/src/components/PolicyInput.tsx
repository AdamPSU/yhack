"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { MapType } from "@/game/config";
import { setReplayData } from "@/lib/replayStore";
import { POLICY_PRESETS } from "@/mocks/mockData";
import { startSimulation } from "@/services/wsClient";
import type { SavedSimulation } from "@/types/backend";

const MAP_OPTIONS: { id: MapType; label: string; desc: string }[] = [
  { id: "ccity", label: "CCity", desc: "Large 80x60 modern city" },
  { id: "pico8", label: "Pico-8 City", desc: "Compact 55x30 retro town" },
  { id: "citypack", label: "Citypack", desc: "Infinite procedural city" },
];

function isSavedSimulation(data: unknown): data is SavedSimulation {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<SavedSimulation>;
  return (
    candidate.initMsg?.type === "init" &&
    Array.isArray(candidate.initMsg.npcs) &&
    Array.isArray(candidate.rounds)
  );
}

export function PolicyInput() {
  const [text, setText] = useState("");
  const [mapId, setMapId] = useState<MapType>("ccity");
  const [procedural, setProcedural] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCustomRun, setLoadingCustomRun] = useState(false);
  const [record, setRecord] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function loadReplay(
    data: SavedSimulation,
    replayMapId: MapType,
    replayProcedural = false,
  ) {
    const proceduralParam =
      replayMapId === "citypack" && replayProcedural ? "&procedural=true" : "";
    setReplayData(data);
    router.push(`/simulate?mode=replay&map=${replayMapId}${proceduralParam}`);
  }

  function handleLoadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as SavedSimulation;
        if (!isSavedSimulation(parsed)) {
          console.error("Invalid simulation file: missing initMsg or rounds");
          return;
        }
        loadReplay(parsed, mapId, procedural);
      } catch (err) {
        console.error("Failed to parse simulation file:", err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleLoadCustomRun() {
    if (loadingCustomRun) return;
    setLoadingCustomRun(true);
    try {
      const module = await import("@/custom_run.json");
      const bundledReplay = module.default as unknown;
      if (!isSavedSimulation(bundledReplay)) {
        console.error("Bundled custom run is invalid");
        setLoadingCustomRun(false);
        return;
      }
      loadReplay(bundledReplay, "citypack");
    } catch (err) {
      console.error("Failed to load bundled custom run:", err);
      setLoadingCustomRun(false);
    }
  }

  async function handleSimulate() {
    if (text.trim().length < 20 || loading) return;
    const proceduralParam =
      mapId === "citypack" && procedural ? "&procedural=true" : "";
    const recordParam = record ? "&record=true" : "";
    if (process.env.NEXT_PUBLIC_MOCK_BACKEND === "true") {
      router.push(`/simulate?map=${mapId}${proceduralParam}${recordParam}`);
      return;
    }
    setLoading(true);
    try {
      const simId = await startSimulation(text);
      router.push(
        `/simulate?id=${simId}&map=${mapId}${proceduralParam}${recordParam}`,
      );
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
              {opt.id === "citypack" && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setProcedural((p) => !p);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      setProcedural((p) => !p);
                    }
                  }}
                  className="mt-1 block text-[9px] font-mono text-[#5a4a32] hover:text-[#e8a43a] transition-colors cursor-pointer"
                >
                  [{procedural ? "■" : "□"}] Procedural:{" "}
                  {procedural ? "ON" : "OFF"}
                </span>
              )}
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

      {/* Record toggle + Simulate button */}
      <div className="flex gap-3 items-stretch">
        <button
          type="button"
          onClick={() => setRecord((r) => !r)}
          data-testid="record-toggle"
          className={`rpg-panel px-4 py-3 text-xs font-mono transition-all duration-150 active:translate-y-px shrink-0 ${
            record
              ? "border-[#d45050] bg-[#2a1515] text-[#d45050] shadow-[0_0_8px_rgba(212,80,80,0.2)]"
              : "text-[#5a4a32] hover:border-[#6a5a42] hover:text-[#8a7a62]"
          }`}
          title={
            record
              ? "Recording enabled — simulation will be saved to JSON"
              : "Enable recording to save simulation as JSON"
          }
        >
          [{record ? "REC" : "OFF"}]
        </button>
        <button
          type="button"
          onClick={handleSimulate}
          disabled={text.trim().length < 20 || loading}
          suppressHydrationWarning
          data-testid="simulate-button"
          className="rpg-panel flex-1 px-6 py-3 text-sm font-mono font-bold text-[#e8a43a] transition-all duration-150 hover:bg-[#2a2218] hover:border-[#e8a43a] hover:shadow-[0_0_8px_rgba(232,164,58,0.2)] disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-px"
        >
          {loading ? ">> Starting... <<" : ">> Run Simulation <<"}
        </button>
      </div>

      {/* Replay loaders */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleLoadCustomRun}
          disabled={loadingCustomRun}
          data-testid="load-custom-run-button"
          className="rpg-panel w-full px-6 py-2 text-xs font-mono text-[#8a7a62] transition-all duration-150 hover:bg-[#2a2218] hover:border-[#6a5a42] hover:text-[#d4c4a0] disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px"
        >
          {loadingCustomRun
            ? ">> Loading Custom Run... <<"
            : ">> Load Custom Run <<"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleLoadFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          data-testid="load-simulation-button"
          className="rpg-panel w-full px-6 py-2 text-xs font-mono text-[#8a7a62] transition-all duration-150 hover:bg-[#2a2218] hover:border-[#6a5a42] hover:text-[#d4c4a0] active:translate-y-px"
        >
          {">> Load Saved Simulation <<"}
        </button>
      </div>
    </div>
  );
}
