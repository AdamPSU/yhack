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
      {/* Preset buttons */}
      <div>
        <p className="mb-2 text-[9px] font-mono tracking-[0.2em] uppercase text-[#6a5a42]">
          /// Policy Presets
        </p>
        <div className="flex flex-wrap gap-2" data-testid="preset-buttons">
          {POLICY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setText(preset.text)}
              data-testid={`preset-${preset.id}`}
              className="terminal-btn"
              style={{ padding: "6px 16px", fontSize: "11px" }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Policy textarea */}
      <div>
        <p className="mb-2 text-[9px] font-mono tracking-[0.2em] uppercase text-[#6a5a42]">
          /// Policy Input
        </p>
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe an economic policy in ~500 words..."
            data-testid="policy-textarea"
            rows={8}
            className="rpg-panel w-full resize-none p-4 text-sm leading-relaxed font-mono text-[#d4c4a0] placeholder-[#3a2e1e] outline-none transition-all duration-150 focus:border-[#e8a43a] focus:shadow-[0_0_12px_rgba(232,164,58,0.1)]"
          />
          <span className="absolute right-3 bottom-3 text-[9px] font-mono uppercase tracking-wider text-[#3a2e1e]">
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
          className="rpg-panel flex-1 px-6 py-3 text-sm font-mono font-bold uppercase tracking-wider text-[#e8a43a] transition-all duration-150 hover:bg-[#2a2218] hover:border-[#e8a43a] hover:shadow-[0_0_12px_rgba(232,164,58,0.2)] disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-px"
          style={{ textShadow: "0 0 8px rgba(232,164,58,0.3)" }}
        >
          {loading ? "[ Starting... ]" : "[ Run Simulation ]"}
        </button>
      </div>

      {/* Replay loaders */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={handleLoadCustomRun}
          disabled={loadingCustomRun}
          data-testid="load-custom-run-button"
          className="terminal-btn w-full text-center"
          style={{ padding: "8px 24px", fontSize: "11px" }}
        >
          {loadingCustomRun
            ? "Loading Custom Run..."
            : "Load Custom Run"}
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
          className="terminal-btn w-full text-center"
          style={{ padding: "8px 24px", fontSize: "11px" }}
        >
          Load Saved Simulation
        </button>
      </div>
    </div>
  );
}
