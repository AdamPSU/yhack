'use client';

import { Handle, Position } from '@xyflow/react';
import StarBorder from '@/components/StarBorder';

interface Props {
  badge: string;
  title: string;
  children: React.ReactNode;
  hasTarget?: boolean;
  hasSource?: boolean;
  badgeColor?: string;
  badgeGlow?: string;
}

const handleStyle = {
  background: 'rgba(168,85,247,0.9)',
  width: 10,
  height: 10,
  border: '2px solid rgba(192,132,252,1)',
};

export default function NodeWrapper({ 
  badge, 
  title, 
  children, 
  hasTarget = true, 
  hasSource = true,
  badgeColor = 'text-purple-400',
  badgeGlow = 'rgba(168,85,247,0.6)'
}: Props) {
  return (
    <div style={{ 
      position: 'relative',
      filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.25))'
    }}>
      {hasTarget && <Handle type="target" position={Position.Left} style={handleStyle} />}
      <StarBorder as="div" color="rgba(255,255,255,0.3)" speed="6s">
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-white/10">
            <span 
              className={`text-[9px] font-mono ${badgeColor} bg-white/5 px-1.5 py-0.5 rounded`}
              style={{ filter: `drop-shadow(0 0 5px ${badgeGlow})` }}
            >
              {badge}
            </span>
            <span className="text-[11px] font-mono font-bold text-white tracking-widest">{title}</span>
          </div>
          {children}
        </div>
      </StarBorder>
      {hasSource && <Handle type="source" position={Position.Right} style={handleStyle} />}
    </div>
  );
}
