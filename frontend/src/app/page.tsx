import { PolicyInput } from "@/components/PolicyInput";
import LiquidEtherBackground from "@/components/LiquidEther/LiquidEtherBackground";
import ASCIITextHero from "@/components/ASCIIText/ASCIITextHero";
import RetroTV from "@/components/RetroTV";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <LiquidEtherBackground />
      <RetroTV />
      <main
        className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-8"
        data-testid="landing-page"
      >
        {/* Title */}
        <div className="w-full text-center space-y-1">
          <ASCIITextHero />
          <p className="text-[10px] tracking-[0.3em] uppercase text-white/40">
            Economic Policy Simulator
          </p>
          <p
            className="text-[11px] text-white/40"
            data-testid="landing-description"
          >
            Describe a policy · watch 25 AI agents react in real time
          </p>
        </div>

        {/* Policy input */}
        <PolicyInput />

        {/* Footer */}
        <p className="text-[10px] text-white/30">
          Agent-based Governance and Outcome Response Analysis
        </p>
      </main>
    </div>
  );
}
