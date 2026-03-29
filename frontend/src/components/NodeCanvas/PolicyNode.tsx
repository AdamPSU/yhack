'use client';

import { useRef } from 'react';
import NodeWrapper from './NodeWrapper';
import { useForm } from './FormContext';
import { POLICY_PRESETS } from '@/mocks/mockData';

const ACCEPTED = '.txt,.md,.pdf,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.webp';

export default function PolicyNode() {
  const { text, setText, fileName, extracting, handleFile } = useForm();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <NodeWrapper 
      badge="01" 
      title="POLICY" 
      description="Identify a policy or document to analyze."
      hasTarget={false}
    >
      <div className="nodrag nopan space-y-3" style={{ width: 360 }}>
        <div className="flex flex-wrap gap-1.5">
          {POLICY_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setText(preset.text)}
              className="rpg-panel px-2 py-1 text-[10px] font-mono text-white hover:border-white active:translate-y-px"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Upload .md, .txt, or policy photos. Snap a policy, we'll extract the rules. Multimodal-ready."
            rows={8}
            className="rpg-panel w-full resize-none p-3 text-xs leading-relaxed font-mono text-white placeholder-white/40 outline-none focus:border-purple-400/50 transition-colors"
          />
          <span className="absolute right-2 bottom-2 text-[9px] font-mono text-white/60">{text.length} chars</span>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept={ACCEPTED} onChange={handleFile} className="hidden" id="policy-file-node" />
          <label
            htmlFor="policy-file-node"
            className={`rpg-panel px-3 py-1.5 text-[10px] font-mono cursor-pointer hover:border-white hover:text-white ${extracting ? 'opacity-50 cursor-wait text-white/50' : 'text-white'}`}
          >
            {extracting ? 'Extracting...' : '↑ Multimodal Upload'}
          </label>
          {fileName && !extracting && (
            <span className="text-[9px] font-mono text-white/80 truncate max-w-[130px]">{fileName}</span>
          )}
          <span className="text-[9px] font-mono text-white/60 ml-auto">PDF · MD · TXT · IMG</span>
        </div>
      </div>
    </NodeWrapper>
  );
}
