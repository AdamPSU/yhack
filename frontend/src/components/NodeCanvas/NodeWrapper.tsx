'use client';

import { Handle, Position } from '@xyflow/react';
import StarBorder from '@/components/StarBorder';
import BorderGlow from '@/components/BorderGlow/BorderGlow';
import DecryptedText from '@/components/DecryptedText';

interface Props {
  badge: string;
  title: string;
  description?: string;
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
  description,
  children, 
  hasTarget = true, 
  hasSource = true,
  badgeColor = 'text-purple-300',
  badgeGlow = 'rgba(168,85,247,0.7)'
}: Props) {
  return (
    <div style={{ 
      position: 'relative',
      filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.125))'
    }}>
      {hasTarget && <Handle type="target" position={Position.Left} style={handleStyle} />}
      <BorderGlow
        borderRadius={12}
        glowRadius={30}
        glowIntensity={0.8}
        backgroundColor="#1a1510"
        colors={['rgba(168,85,247,0.5)', 'rgba(255,255,255,0.2)', 'rgba(168,85,247,0.3)']}
      >
        <StarBorder as="div" color="rgba(255,255,255,0.3)" speed="6s">
          <div className="space-y-3">
            <div className="space-y-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span 
                  className={`text-[7px] font-pixel ${badgeColor} bg-white/5 px-1.5 py-0.5 rounded leading-none`}
                  style={{ filter: `drop-shadow(0 0 5px ${badgeGlow})` }}
                >
                  {badge}
                </span>
                <DecryptedText 
                  text={title}
                  speed={80}
                  maxIterations={20}
                  animateOn="hover"
                  className="text-[8px] font-pixel font-bold text-white tracking-tight"
                  encryptedClassName="text-[8px] font-pixel font-bold text-purple-400 tracking-tight"
                />
              </div>
              {description && (
                <p className="text-[9px] font-mono text-purple-300/80 leading-tight uppercase tracking-widest border-l border-purple-400/40 pl-2">
                  {description}
                </p>
              )}
            </div>
            {children}
          </div>
        </StarBorder>
      </BorderGlow>
      {hasSource && <Handle type="source" position={Position.Right} style={handleStyle} />}
    </div>
  );
}
