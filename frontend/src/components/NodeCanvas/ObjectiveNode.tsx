'use client';

import NodeWrapper from './NodeWrapper';
import { useForm } from './FormContext';

export default function ObjectiveNode() {
  const { objective, setObjective } = useForm();

  return (
    <NodeWrapper badge="03" title="OBJECTIVE" description="Specify what to look for.">
      <div className="nodrag nopan space-y-3" style={{ width: 240 }}>
        <div className="relative">
          <textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder={"What are you curious about?\n\ne.g. 'How does this affect\nlow-income workers?'"}
            rows={6}
            maxLength={500}
            className="rpg-panel w-full resize-none p-3 text-xs leading-relaxed font-mono text-white placeholder-white/40 outline-none focus:border-purple-400/50 transition-colors"
          />
          <span className="absolute right-2 bottom-2 text-[9px] font-mono text-white/60">{objective.length}/500</span>
        </div>
      </div>
    </NodeWrapper>
  );
}
