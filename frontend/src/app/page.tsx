import { PolicyInput } from "@/components/PolicyInput";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <main
        className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-8"
        data-testid="landing-page"
      >
        {/* Title */}
        <div className="text-center">
          <h1 className="font-mono text-5xl font-bold tracking-tight text-[#e8a43a]">
            AGORA
          </h1>
          <p className="mt-2 text-xs tracking-[0.25em] uppercase text-[#8a7a62]">
            Economic Policy Simulator
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <div className="h-px flex-1 bg-[#4a3c2a]" />
          <span className="text-[10px] text-[#6a5a42]">{"< * >"}</span>
          <div className="h-px flex-1 bg-[#4a3c2a]" />
        </div>

        {/* Description */}
        <p
          className="max-w-md text-center text-sm leading-relaxed text-[#a89878]"
          data-testid="landing-description"
        >
          Describe an economic policy and watch 20 AI agents react in real time.
          See how decisions cascade from boardrooms to kitchen tables.
        </p>

        {/* Policy input */}
        <PolicyInput />

        {/* Footer */}
        <p className="text-[10px] text-[#5a4a32]">
          Agent-based Governance and Outcome Response Analysis
        </p>
      </main>
    </div>
  );
}
