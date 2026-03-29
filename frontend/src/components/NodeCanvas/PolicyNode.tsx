'use client';

import { useRef } from 'react';
import NodeWrapper from './NodeWrapper';
import { useForm } from './FormContext';

const PDF_ACCEPTED = '.pdf';
const CSV_ACCEPTED = '.csv';

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
      <div className="nodrag nopan space-y-3" style={{ width: 400 }}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
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
              className={`rpg-panel px-3 py-1.5 text-[10px] font-mono cursor-pointer hover:border-white hover:text-white ${
                uploadingPrimary ? 'opacity-50 cursor-wait text-white/50' : 'text-white'
              }`}
            >
              {uploadingPrimary ? 'Uploading PDF...' : '↑ Primary Policy PDF'}
            </label>
            <span className="text-[9px] font-mono text-white/60">
              {primaryPolicy ? 'READY' : 'REQUIRED'}
            </span>
          </div>
          {primaryPolicy && (
            <div className="rpg-panel border-white/20 bg-black/30 p-2 text-[9px] font-mono text-white/80">
              <div className="text-white">{primaryPolicy.filename}</div>
              <div className="mt-1 line-clamp-4 whitespace-pre-wrap text-white/60">
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
            className="rpg-panel w-full resize-none p-3 text-xs leading-relaxed font-mono text-white placeholder-white/40 outline-none focus:border-purple-400/50 transition-colors"
          />
          <span className="absolute right-2 bottom-2 text-[9px] font-mono text-white/60">{notesText.length} chars</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
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
              className={`rpg-panel px-3 py-1.5 text-[10px] font-mono cursor-pointer hover:border-white hover:text-white ${
                uploadingTrends ? 'opacity-50 cursor-wait text-white/50' : 'text-white'
              }`}
            >
              {uploadingTrends ? 'Uploading CSV...' : '+ Trend CSV'}
            </label>
            <span className="text-[9px] font-mono text-white/60">
              {trendSources.length} attached
            </span>
          </div>
          {trendSources.length > 0 && (
            <div className="space-y-1">
              {trendSources.map((source) => (
                <div
                  key={source.id}
                  className="rpg-panel flex items-start gap-2 border-white/20 bg-black/30 p-2 text-[9px] font-mono text-white/80"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-white">{source.filename}</div>
                    <div className="mt-1 line-clamp-3 whitespace-pre-wrap text-white/60">
                      {source.summary}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTrendSource(source.id)}
                    className="text-white/50 transition hover:text-white"
                    data-testid={`remove-trend-${source.id}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[9px] font-mono text-white/60">
          <span>PDF policy required</span>
          <span className="ml-auto">CSV trends optional</span>
        </div>
      </div>
    </NodeWrapper>
  );
}
