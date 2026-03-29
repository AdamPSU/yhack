import LiquidEtherBackground from "@/components/LiquidEther/LiquidEtherBackground";
import ASCIITextHero from "@/components/ASCIIText/ASCIITextHero";
import RetroTV from "@/components/RetroTV";
import DecryptedText from "@/components/DecryptedText";
import NodeCanvasClient from "@/components/NodeCanvas/NodeCanvasClient";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center">
      <LiquidEtherBackground />
      <RetroTV />
      <main
        className="relative z-10 flex w-full flex-col items-center gap-6 px-8"
        data-testid="landing-page"
      >
        {/* Title */}
        <div className="w-full max-w-2xl text-center">
          <ASCIITextHero />
          <p
            className="text-[10px] tracking-[0.3em] uppercase text-white/40 mt-[8px] italic"
            style={{ textShadow: "0 0 12px rgba(255,255,255,0.4), 0 0 30px rgba(255,255,255,0.2)" }}
          >
            Agent-based Governance and Outcome Response Analysis
          </p>
        </div>

        {/* Node canvas */}
        <NodeCanvasClient />

        {/* Footer */}
        <div 
          className="flex flex-col items-center gap-1 opacity-30 italic"
          style={{ filter: 'drop-shadow(0 0 15px rgba(255,255,255,0.3))' }}
        >
          <p
            className="text-[9px] tracking-[0.2em] uppercase text-white"
          >
            <DecryptedText
              text="Economic Policy Simulator"
              animateOn="view"
              sequential
              revealDirection="start"
              speed={40}
              className="text-white"
              encryptedClassName="text-white/20"
            />
          </p>
          <p
            className="text-[10px] text-white"
            data-testid="landing-description"
          >
            <DecryptedText
              text="Describe a policy · watch AI agents react in real time"
              animateOn="view"
              sequential
              revealDirection="start"
              speed={25}
              className="text-white"
              encryptedClassName="text-white/20"
            />
          </p>
        </div>
      </main>
    </div>
  );
}
