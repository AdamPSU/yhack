'use client';

import NodeWrapper from './NodeWrapper';
import { useForm } from './FormContext';

export default function ObjectiveNode() {
  const { objective, setObjective } = useForm();

  return (
    <NodeWrapper badge="03" title="OBJECTIVE">
      <div className="nodrag nopan relative" style={{ width: 240 }}>
        <textarea
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder={"What are you curious about?\n\ne.g. 'How does this affect\nlow-income workers?'"}
          rows={6}
          maxLength={500}
          className="rpg-panel w-full resize-none p-3 text-xs leading-relaxed font-mono text-white placeholder-[#555555] outline-none"
        />
        <span className="absolute right-2 bottom-2 text-[9px] font-mono text-[#555555]">{objective.length}/500</span>
      </div>
    </NodeWrapper>
  );
}
