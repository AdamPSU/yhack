'use client';

import NodeWrapper from './NodeWrapper';
import { useForm } from './FormContext';

export default function ConfigNode() {
  const { numNpcs, setNumNpcs, numRounds, setNumRounds, mapId, setMapId } = useForm();

  return (
    <NodeWrapper badge="02" title="CONFIG" description="Slide to adjust agents and rounds.">
      <div className="nodrag nopan space-y-4" style={{ width: 220 }}>
        {/* NPCs */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[8px] font-mono text-white/70 uppercase tracking-tight">Scale</span>
              <label className="text-[10px] font-mono font-bold text-white">NPCS</label>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-mono font-bold text-purple-400">{numNpcs}</span>
              <span className="text-[8px] font-mono text-white/60">units</span>
            </div>
          </div>
          <input
            type="range" min="5" max="50" step="1"
            value={numNpcs}
            onChange={(e) => setNumNpcs(parseInt(e.target.value))}
            className="rpg-slider"
            data-testid="npcs-slider"
          />
        </div>

        {/* Rounds */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[8px] font-mono text-white/70 uppercase tracking-tight">Depth</span>
              <label className="text-[10px] font-mono font-bold text-white">ROUNDS</label>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-mono font-bold text-purple-400">{numRounds}</span>
              <span className="text-[8px] font-mono text-white/60">steps</span>
            </div>
          </div>
          <input
            type="range" min="3" max="20" step="1"
            value={numRounds}
            onChange={(e) => setNumRounds(parseInt(e.target.value))}
            className="rpg-slider"
            data-testid="rounds-slider"
          />
        </div>

        {/* Map Selection */}
        <div className="space-y-1.5">
          <div className="flex flex-col">
            <span className="text-[8px] font-mono text-white/70 uppercase tracking-tight">World</span>
            <label className="text-[10px] font-mono font-bold text-white uppercase">Topology</label>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'ccity', label: 'URBAN' },
              { id: 'citypack', label: 'MEGA' },
              { id: 'pico8', label: 'MICRO' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMapId(m.id as any)}
                className={`
                  text-[8px] font-mono py-1 border transition-all
                  ${mapId === m.id 
                    ? 'bg-purple-500/20 border-purple-400 text-white' 
                    : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20'}
                `}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </NodeWrapper>
  );
}
