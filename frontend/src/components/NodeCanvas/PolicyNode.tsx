"use client";

import { useRef } from "react";
import { useForm } from "./FormContext";
import NodeWrapper from "./NodeWrapper";

const PDF_ACCEPTED = ".pdf";
const CSV_ACCEPTED = ".csv";

export default function PolicyNode() {
  const {
    notesText,
    setNotesText,
    primaryPolicy,
    trendSources,
    uploadingPrimary,
    uploadingTrends,
    handlePrimaryPolicyFile,
    handleTrendFiles,
    removeTrendSource,
  } = useForm();
  const pdfRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  return (
    <NodeWrapper
      badge="01"
      title="POLICY"
      description="Upload one primary policy PDF, then add optional notes and trend CSVs."
      hasTarget={false}
    >
      <div className="nodrag nopan space-y-3" style={{ width: 480 }}>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={pdfRef}
              type="file"
              accept={PDF_ACCEPTED}
              onChange={handlePrimaryPolicyFile}
              className="hidden"
              id="policy-pdf-node"
              data-testid="policy-pdf-input"
            />
            <label
              htmlFor="policy-pdf-node"
              data-testid="upload-pdf-button"
              className="rpg-panel px-3 py-1.5 text-[10px] font-mono cursor-pointer transition-opacity hover:opacity-80"
              style={{
                color: uploadingPrimary ? "#A0824A" : "#3D2510",
                background: "#E8D5A3",
                opacity: uploadingPrimary ? 0.6 : 1,
              }}
            >
              {uploadingPrimary
                ? "Uploading PDF..."
                : "\u2191 Primary Policy PDF"}
            </label>
            <span
              className="text-[9px] font-mono"
              style={{ color: primaryPolicy ? "#3E7C34" : "#B83A52" }}
            >
              {primaryPolicy ? "\u2605 READY" : "REQUIRED"}
            </span>

            <span className="text-[9px] font-mono" style={{ color: "#C4A46C" }}>
              |
            </span>

            <input
              ref={csvRef}
              type="file"
              accept={CSV_ACCEPTED}
              onChange={handleTrendFiles}
              className="hidden"
              id="policy-csv-node"
              data-testid="trend-csv-input"
              multiple
            />
            <label
              htmlFor="policy-csv-node"
              data-testid="upload-csv-button"
              className="rpg-panel px-3 py-1.5 text-[10px] font-mono cursor-pointer transition-opacity hover:opacity-80"
              style={{
                color: uploadingTrends ? "#A0824A" : "#3D2510",
                background: "#E8D5A3",
                opacity: uploadingTrends ? 0.6 : 1,
              }}
            >
              {uploadingTrends ? "Uploading CSV..." : "+ Trend CSV"}
            </label>
            <span className="text-[9px] font-mono" style={{ color: "#8B7355" }}>
              {trendSources.length} attached
            </span>
          </div>
          {primaryPolicy && (
            <div
              className="rounded p-2 text-[9px] font-mono"
              style={{
                background: "#FFF8DC",
                border: "1px solid #C4A46C",
                color: "#6B4C2A",
              }}
            >
              <div style={{ color: "#3D2510" }}>{primaryPolicy.filename}</div>
              <div
                className="mt-1 line-clamp-4 whitespace-pre-wrap"
                style={{ color: "#8B7355" }}
              >
                {primaryPolicy.preview_text}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <textarea
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            data-testid="policy-textarea"
            placeholder="Optional supporting notes. Use this for analysis focus, caveats, scenario framing, or what you want the simulation to pay attention to."
            rows={6}
            className="rpg-panel w-full resize-none p-3 text-xs leading-relaxed font-mono outline-none transition-colors"
            style={{
              color: "#3D2510",
              background: "#FFF8DC",
              borderColor: notesText.length > 0 ? "#D4A520" : undefined,
            }}
          />
          <span
            className="absolute right-2 bottom-2 text-[9px] font-mono"
            style={{ color: "#A0824A" }}
          >
            {notesText.length} chars
          </span>
        </div>

        {/* CSV previews */}
        {trendSources.length > 0 && (
          <div className="space-y-1">
            {trendSources.map((source) => (
              <div
                key={source.id}
                className="flex items-start gap-2 rounded p-2 text-[9px] font-mono"
                style={{
                  background: "#FFF8DC",
                  border: "1px solid #C4A46C",
                  color: "#6B4C2A",
                }}
              >
                <div className="min-w-0 flex-1">
                  <div style={{ color: "#3D2510" }}>{source.filename}</div>
                  <div
                    className="mt-1 line-clamp-3 whitespace-pre-wrap"
                    style={{ color: "#8B7355" }}
                  >
                    {source.summary}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeTrendSource(source.id)}
                  className="transition-opacity hover:opacity-60"
                  style={{ color: "#B83A52" }}
                  data-testid={`remove-trend-${source.id}`}
                >
                  {"\u00D7"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </NodeWrapper>
  );
}
