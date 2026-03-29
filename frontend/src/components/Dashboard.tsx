"use client";

import { ArcGauge } from "@/components/dashboard/ArcGauge";
import { SparklineCard } from "@/components/dashboard/SparklineCard";
import type { SimMetrics } from "@/types";

interface DashboardProps {
  metrics: SimMetrics;
  metricsHistory: SimMetrics[];
  phase: number;
  month: number;
}

function priceSeverity(v: number) {
  const abs = Math.abs(v);
  if (abs < 3) return "good" as const;
  if (abs < 7) return "warn" as const;
  return "bad" as const;
}

function unempSeverity(v: number) {
  if (v < 4.5) return "good" as const;
  if (v < 5.5) return "warn" as const;
  return "bad" as const;
}

function zeroOneSeverity(v: number, invert = false) {
  const effective = invert ? 1 - v : v;
  if (effective > 0.7) return "good" as const;
  if (effective > 0.4) return "warn" as const;
  return "bad" as const;
}

export function Dashboard({
  metrics,
  metricsHistory,
  phase,
  month,
}: DashboardProps) {
  return (
    <div
      className="rpg-panel flex h-full w-56 flex-col"
      data-testid="dashboard"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#3a2e1e] px-3 py-2">
        <span className="text-[10px] font-mono font-bold uppercase text-[#e8a43a]">
          Phase {phase || "-"}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-[#8a7a62]">
          Month {month || "-"}
        </span>
      </div>

      {/* Charts */}
      <div className="flex flex-1 flex-col overflow-y-auto scrollbar-thin px-1 py-1">
        {/* Sparkline time-series metrics */}
        <SparklineCard
          label="Prices"
          values={metricsHistory.map((m) => m.priceIndex)}
          currentValue={metrics.priceIndex}
          formatValue={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
          severity={priceSeverity(metrics.priceIndex)}
          baseline={0}
          domain={[-10, 15]}
        />
        <SparklineCard
          label="Unemployment"
          values={metricsHistory.map((m) => m.unemploymentRate)}
          currentValue={metrics.unemploymentRate}
          formatValue={(v) => `${v.toFixed(1)}%`}
          severity={unempSeverity(metrics.unemploymentRate)}
          baseline={4.2}
          domain={[3, 10]}
        />
        <SparklineCard
          label="Interest Rate"
          values={metricsHistory.map((m) => m.interestRate)}
          currentValue={metrics.interestRate}
          formatValue={(v) => `${v.toFixed(2)}%`}
          severity="neutral"
          baseline={5.25}
          domain={[3, 8]}
        />

        {/* Arc gauge ratio metrics */}
        <ArcGauge
          label="Social Unrest"
          value={metrics.socialUnrest}
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
          severity={zeroOneSeverity(metrics.socialUnrest, true)}
        />
        <ArcGauge
          label="Businesses Open"
          value={metrics.businessSurvival}
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
          severity={zeroOneSeverity(metrics.businessSurvival)}
        />
        <ArcGauge
          label="Gov. Approval"
          value={metrics.govApproval}
          formatValue={(v) => `${(v * 100).toFixed(0)}%`}
          severity={zeroOneSeverity(metrics.govApproval)}
        />
      </div>
    </div>
  );
}
