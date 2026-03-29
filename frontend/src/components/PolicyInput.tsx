"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { POLICY_PRESETS } from "@/mocks/mockData";
import { extractFile } from "@/services/wsClient";

const ACCEPTED = ".txt,.md,.pdf,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.webp";

export function PolicyInput() {
  const [text, setText] = useState("");
  const [numNpcs, setNumNpcs] = useState(25);
  const [numRounds, setNumRounds] = useState(5);
  const [objective, setObjective] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setExtracting(true);
    try {
      const extracted = await extractFile(file);
      setText((prev) => (prev ? `${prev}\n\n---\n\n${extracted}` : extracted));
    } catch {
      alert("Could not extract text from this file. Try a different format.");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSimulate() {
    if (text.trim().length < 20) return;
    sessionStorage.setItem("agora-policy", text);
    sessionStorage.setItem("agora-num-npcs", numNpcs.toString());
    sessionStorage.setItem("agora-num-rounds", numRounds.toString());
    sessionStorage.setItem("agora-objective", objective);
    router.push("/simulate");
  }

  return (
    <div className="w-full max-w-2xl space-y-4" data-testid="policy-input">
      {/* Simulation Config */}
      <div className="rpg-panel p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-mono font-bold text-white">
              AGENT POPULATION
            </label>
            <span className="text-xs font-mono text-white">{numNpcs} agents</span>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            step="1"
            value={numNpcs}
            onChange={(e) => setNumNpcs(parseInt(e.target.value))}
            className="rpg-slider"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-mono font-bold text-white">
              SIMULATION ROUNDS
            </label>
            <span className="text-xs font-mono text-white">{numRounds} rounds</span>
          </div>
          <input
            type="range"
            min="3"
            max="20"
            step="1"
            value={numRounds}
            onChange={(e) => setNumRounds(parseInt(e.target.value))}
            className="rpg-slider"
          />
        </div>
      </div>

      {/* Objective */}
      <div className="relative">
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="What are you curious about? (e.g. 'How does this affect low-income workers?' or 'Will small businesses survive?')"
          rows={2}
          maxLength={500}
          className="rpg-panel w-full resize-none p-4 text-sm leading-relaxed font-mono text-white placeholder-[#555555] outline-none transition-colors duration-150 focus:border-white"
        />
        <span className="absolute right-3 bottom-3 text-[10px] font-mono text-[#555555]">
          OBJECTIVE
        </span>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2" data-testid="preset-buttons">
        {POLICY_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setText(preset.text)}
            data-testid={`preset-${preset.id}`}
            className="rpg-panel px-4 py-2 text-xs font-mono text-white transition-colors duration-150 hover:border-white hover:text-white active:translate-y-px"
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Policy textarea + file upload */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe an economic policy in ~500 words, or upload a file below..."
          data-testid="policy-textarea"
          rows={8}
          className="rpg-panel w-full resize-none p-4 text-sm leading-relaxed font-mono text-white placeholder-[#555555] outline-none transition-colors duration-150 focus:border-white"
        />
        <span className="absolute right-3 bottom-3 text-[10px] font-mono text-[#555555]">
          {text.length} chars
        </span>
      </div>

      {/* File upload row */}
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          onChange={handleFile}
          className="hidden"
          id="policy-file-input"
        />
        <label
          htmlFor="policy-file-input"
          className={`rpg-panel px-4 py-2 text-xs font-mono cursor-pointer transition-colors duration-150 hover:border-white hover:text-white active:translate-y-px ${extracting ? "opacity-50 cursor-wait" : "text-white"}`}
        >
          {extracting ? "Extracting..." : "↑ Upload File"}
        </label>
        {fileName && !extracting && (
          <span className="text-[10px] font-mono text-[#888888] truncate max-w-xs">
            {fileName}
          </span>
        )}
        <span className="text-[10px] font-mono text-[#555555] ml-auto">
          PDF · MD · TXT · PPTX · Image
        </span>
      </div>

      {/* Simulate button */}
      <button
        type="button"
        onClick={handleSimulate}
        disabled={text.trim().length < 20}
        data-testid="simulate-button"
        className="rpg-panel w-full px-6 py-3 text-sm font-mono font-bold text-white transition-all duration-150 hover:bg-[#1a1a1a] hover:border-white hover:shadow-[0_0_8px_rgba(255,255,255,0.2)] disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-px"
      >
        {">> Run Simulation <<"}
      </button>
    </div>
  );
}
