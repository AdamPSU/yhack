'use client';

import dynamic from 'next/dynamic';
import { SiReact, SiNextdotjs, SiTypescript, SiTailwindcss, SiFastapi, SiPython, SiBun, SiLangchain, SiOpenai } from 'react-icons/si';
import LogoLoop from '../LogoLoop/LogoLoop';

const ASCIIText = dynamic(() => import('./ASCIIText'), { ssr: false });

const techLogos = [
  { node: <SiNextdotjs title="Next.js" />, title: "Next.js", href: "https://nextjs.org" },
  { node: <SiReact title="React" />, title: "React", href: "https://react.dev" },
  { node: <SiTypescript title="TypeScript" />, title: "TypeScript", href: "https://www.typescriptlang.org" },
  { node: <SiTailwindcss title="Tailwind CSS" />, title: "Tailwind CSS", href: "https://tailwindcss.com" },
  { node: <SiFastapi title="FastAPI" />, title: "FastAPI", href: "https://fastapi.tiangolo.com" },
  { node: <SiPython title="Python" />, title: "Python", href: "https://www.python.org" },
  { node: <SiBun title="Bun" />, title: "Bun", href: "https://bun.sh" },
  { node: <SiLangchain title="LangChain" />, title: "LangChain", href: "https://www.langchain.com" },
  { node: <SiOpenai title="OpenAI" />, title: "OpenAI", href: "https://openai.com" },
];

export default function ASCIITextHero() {
  return (
    <div className="flex flex-col items-center">
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
      <div 
        className="w-[360px] mt-[-15px] opacity-40 hover:opacity-100 transition-opacity"
        style={{ filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.4))' }}
      >
        <LogoLoop
          logos={techLogos}
          speed={30}
          direction="left"
          logoHeight={24}
          gap={40}
          hoverSpeed={0}
          fadeOut
          fadeOutColor="#1a1510"
        />
      </div>
    </div>
  );
}
