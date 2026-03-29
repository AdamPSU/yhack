'use client';

import NodeWrapper from './NodeWrapper';
import { useForm } from './FormContext';

export default function ConfigNode() {
  const { numNpcs, setNumNpcs, numRounds, setNumRounds } = useForm();

  return (
    <NodeWrapper badge="02" title="CONFIG">
      <div className="nodrag nopan space-y-5" style={{ width: 240 }}>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-mono font-bold text-white">AGENT POPULATION</label>
            <span className="text-[10px] font-mono text-white">{numNpcs}</span>
          </div>
          <input
            type="range" min="5" max="50" step="1"
            value={numNpcs}
            onChange={(e) => setNumNpcs(parseInt(e.target.value))}
            className="rpg-slider"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-mono font-bold text-white">SIMULATION ROUNDS</label>
            <span className="text-[10px] font-mono text-white">{numRounds}</span>
          </div>
          <input
            type="range" min="3" max="20" step="1"
            value={numRounds}
            onChange={(e) => setNumRounds(parseInt(e.target.value))}
            className="rpg-slider"
          />
        </div>
      </div>
    </NodeWrapper>
  );
}
