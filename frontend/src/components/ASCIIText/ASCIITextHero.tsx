'use client';

import dynamic from 'next/dynamic';

const ASCIIText = dynamic(() => import('./ASCIIText'), { ssr: false });

export default function ASCIITextHero() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '160px', filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.5)) drop-shadow(0 0 80px rgba(255,255,255,0.2)) drop-shadow(0 0 140px rgba(255,255,255,0.1))' }}>
      <ASCIIText
        text="SIMULACRA"
        enableWaves
        asciiFontSize={8}
        textFontSize={200}
        textColor="#ffffff"
        planeBaseHeight={8}
      />
    </div>
  );
}
