'use client';

import NodeWrapper from './NodeWrapper';
import { useForm } from './FormContext';

export default function RunNode() {
  const { text, handleSimulate } = useForm();
  const canRun = text.trim().length >= 20;

  return (
    <NodeWrapper badge="04" title="RUN" description="Go." hasSource={false}>
      <div className="nodrag nopan flex flex-col items-center gap-3 py-2" style={{ width: 120 }}>
        <button
          type="button"
          onClick={handleSimulate}
          disabled={!canRun}
          data-testid="run-button"
          className="rpg-panel w-full py-5 text-sm font-mono font-bold text-white hover:bg-[#1a1a1a] hover:border-white hover:shadow-[0_0_12px_rgba(168,85,247,0.4)] disabled:opacity-30 disabled:cursor-not-allowed active:translate-y-px transition-all duration-150"
        >
          ▶
        </button>
        <span className="text-[9px] font-mono text-white/60 text-center">
          {canRun ? 'READY' : `${Math.max(0, 20 - text.trim().length)} chars needed`}
        </span>
      </div>
    </NodeWrapper>
  );
}
