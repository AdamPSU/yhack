'use client';

import dynamic from 'next/dynamic';

const NodeCanvas = dynamic(() => import('./index'), { ssr: false });

export default function NodeCanvasClient() {
  return (
    <div style={{ width: '100%', height: 500 }}>
      <NodeCanvas />
    </div>
  );
}
