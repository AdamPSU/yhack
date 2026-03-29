"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { setReplayData } from "@/lib/replayStore";
import { POLICY_PRESETS } from "@/mocks/mockData";
import { startSimulation } from "@/services/wsClient";
import type { SavedSimulation } from "@/types/backend";

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
  const [loading, setLoading] = useState(false);
  const [loadingCustomRun, setLoadingCustomRun] = useState(false);
  const [record, setRecord] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function loadReplay(data: SavedSimulation) {
    setReplayData(data);
    router.push("/simulate?mode=replay&map=citypack");
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
        loadReplay(parsed);
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
      loadReplay(bundledReplay);
    } catch (err) {
      console.error("Failed to load bundled custom run:", err);
      setLoadingCustomRun(false);
    }
  }

  async function handleSimulate() {
    if (text.trim().length < 20 || loading) return;
    const recordParam = record ? "&record=true" : "";
    if (process.env.NEXT_PUBLIC_MOCK_BACKEND === "true") {
      router.push(`/simulate?map=citypack${recordParam}`);
      return;
    }
    setLoading(true);
    try {
      const simId = await startSimulation(text);
      router.push(`/simulate?id=${simId}&map=citypack${recordParam}`);
    } catch (err) {
      console.error("Failed to start simulation:", err);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="policy-input">
      {/* Map selector */}
      <div data-testid="map-selector">
        <p
          className="mb-2 text-[9px] font-mono tracking-[0.2em] uppercase"
          style={{ color: "#A0824A" }}
        >
          {"\u2605"} Select Map
        </p>
        <div className="flex gap-3">
          {MAP_OPTIONS.map((opt) => {
            const isSelected = mapId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMapId(opt.id)}
                data-testid={`map-${opt.id}`}
                className="rpg-panel flex-1 px-4 py-3 text-left transition-all duration-150 active:translate-y-px"
                style={{
                  background: isSelected ? "#EDE4D3" : "#FDF5E6",
                  borderColor: isSelected ? "#D4A520" : undefined,
                  boxShadow: isSelected
                    ? "inset 2px 2px 0 rgba(196,164,108,.5), 0 0 8px rgba(212,165,32,0.15)"
                    : undefined,
                }}
              >
                {/* Mini tile swatch preview */}
                <div className="flex gap-0.5 mb-1.5">
                  {opt.id === "citypack" && (
                    <>
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#5B3A1E" }}
                      />
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#3E7C34" }}
                      />
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#D4A520" }}
                      />
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#7B68EE" }}
                      />
                    </>
                  )}
                  {opt.id === "ccity" && (
                    <>
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#4a4a4a" }}
                      />
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#3E7C34" }}
                      />
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#C97D1A" }}
                      />
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#5A8DB8" }}
                      />
                    </>
                  )}
                  {opt.id === "pico8" && (
                    <>
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#B83A52" }}
                      />
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#3E7C34" }}
                      />
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#5A8DB8" }}
                      />
                      <div
                        className="h-2 w-2 rounded-sm"
                        style={{ background: "#D4A520" }}
                      />
                    </>
                  )}
                </div>
                <span
                  className="block text-sm font-mono font-bold"
                  style={{ color: isSelected ? "#D4A520" : "#5B3A1E" }}
                >
                  {opt.label}
                </span>
                <span
                  className="block mt-0.5 text-[10px] font-mono"
                  style={{ color: "#8B7355" }}
                >
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
                    className="mt-1 block text-[9px] font-mono cursor-pointer transition-opacity hover:opacity-70"
                    style={{ color: procedural ? "#3E7C34" : "#8B7355" }}
                  >
                    [{procedural ? "\u25A0" : "\u25A1"}] Procedural:{" "}
                    {procedural ? "ON" : "OFF"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preset buttons */}
      <div>
        <p
          className="mb-2 text-[9px] font-mono tracking-[0.2em] uppercase"
          style={{ color: "#A0824A" }}
        >
          {"\u2605"} Policy Presets
        </p>
        <div className="flex flex-wrap gap-2" data-testid="preset-buttons">
          {POLICY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setText(preset.text)}
              data-testid={`preset-${preset.id}`}
              className="rpg-panel px-4 py-1.5 text-[11px] font-mono transition-all duration-150 active:translate-y-px hover:opacity-80"
              style={{ color: "#5B3A1E", background: "#FDF5E6" }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Policy textarea */}
      <div>
        <p
          className="mb-2 text-[9px] font-mono tracking-[0.2em] uppercase"
          style={{ color: "#A0824A" }}
        >
          {"\u2605"} Policy Input
        </p>
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe an economic policy in ~500 words..."
            data-testid="policy-textarea"
            rows={8}
            className="rpg-panel w-full resize-none p-4 text-sm leading-relaxed font-mono outline-none transition-all duration-150"
            style={{
              color: "#3D2510",
              background: "#FDF5E6",
              borderColor: text.length > 0 ? "#D4A520" : undefined,
            }}
          />
          <span
            className="absolute right-3 bottom-3 text-[9px] font-mono uppercase tracking-wider"
            style={{ color: "#A0824A" }}
          >
            {text.length} chars
          </span>
        </div>
      </div>

      {/* Record toggle + Simulate button */}
      <div className="flex gap-3 items-stretch">
        <button
          type="button"
          onClick={() => setRecord((r) => !r)}
          data-testid="record-toggle"
          className="rpg-panel px-4 py-3 text-xs font-mono transition-all duration-150 active:translate-y-px shrink-0"
          style={{
            color: record ? "#B83A52" : "#8B7355",
            background: record ? "#FADED4" : "#FDF5E6",
            borderColor: record ? "#B83A52" : undefined,
          }}
          title={
            record
              ? "Recording enabled \u2014 simulation will be saved to JSON"
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
          className="rpg-panel flex-1 px-6 py-3 text-sm font-mono font-bold uppercase tracking-wider transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-px hover:opacity-85"
          style={{
            color: "#3D2510",
            background: "#E8D5A3",
            borderColor: "#D4A520",
          }}
        >
          {loading
            ? "\u2605 Starting... \u2605"
            : "\u2605 Run Simulation \u2605"}
        </button>
      </div>

      {/* Replay loaders */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleLoadCustomRun}
          disabled={loadingCustomRun}
          data-testid="load-custom-run-button"
          className="rpg-panel w-full text-center px-6 py-2 text-[11px] font-mono transition-all duration-150 active:translate-y-px hover:opacity-80 disabled:opacity-40"
          style={{ color: "#5B3A1E", background: "#FDF5E6" }}
        >
          {loadingCustomRun ? "Loading Custom Run..." : "Load Custom Run"}
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
          className="rpg-panel w-full text-center px-6 py-2 text-[11px] font-mono transition-all duration-150 active:translate-y-px hover:opacity-80"
          style={{ color: "#5B3A1E", background: "#FDF5E6" }}
        >
          Load Saved Simulation
        </button>
      </div>
    </div>
  );
}
