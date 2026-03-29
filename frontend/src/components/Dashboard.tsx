"use client";

import type { SimMetrics } from "@/types";

interface DashboardProps {
  metrics: SimMetrics;
  phase: number;
  month: number;
}

interface MetricCardProps {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
  severity: "good" | "warn" | "bad" | "neutral";
}

function MetricCard({ label, value, trend, severity }: MetricCardProps) {
  const severityColor = {
    good: "text-[#5ab85a]",
    warn: "text-[#e8a43a]",
    bad: "text-[#d45050]",
    neutral: "text-[#d4c4a0]",
  }[severity];

  const trendArrow = { up: "\u25B2", down: "\u25BC", neutral: "\u25C6" }[trend];

  return (
    <div className="flex items-center justify-between border-b border-[#3a2e1e] px-2 py-1.5 last:border-b-0">
      <span className="text-[10px] font-mono uppercase text-[#8a7a62]">
        {label}
      </span>
      <span
        className={`text-xs font-mono font-bold tabular-nums ${severityColor}`}
      >
        {trendArrow} {value}
      </span>
    </div>
  );
}

export function Dashboard({ metrics, phase, month }: DashboardProps) {
  function priceSeverity(v: number) {
    if (v < 3) return "good" as const;
    if (v < 7) return "warn" as const;
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

      {/* Metrics */}
      <div className="flex flex-1 flex-col overflow-y-auto px-1 py-1">
        <MetricCard
          label="Prices"
          value={`${metrics.priceIndex >= 0 ? "+" : ""}${metrics.priceIndex.toFixed(1)}%`}
          trend={metrics.priceIndex > 0 ? "up" : "neutral"}
          severity={priceSeverity(metrics.priceIndex)}
        />
        <MetricCard
          label="Unemploy."
          value={`${metrics.unemploymentRate.toFixed(1)}%`}
          trend={metrics.unemploymentRate > 4.2 ? "up" : "neutral"}
          severity={unempSeverity(metrics.unemploymentRate)}
        />
        <MetricCard
          label="Unrest"
          value={`${(metrics.socialUnrest * 100).toFixed(0)}%`}
          trend={metrics.socialUnrest > 0.1 ? "up" : "neutral"}
          severity={zeroOneSeverity(metrics.socialUnrest, true)}
        />
        <MetricCard
          label="Biz Surv."
          value={`${(metrics.businessSurvival * 100).toFixed(0)}%`}
          trend={metrics.businessSurvival < 0.95 ? "down" : "neutral"}
          severity={zeroOneSeverity(metrics.businessSurvival)}
        />
        <MetricCard
          label="Approval"
          value={`${(metrics.govApproval * 100).toFixed(0)}%`}
          trend={metrics.govApproval < 0.6 ? "down" : "neutral"}
          severity={zeroOneSeverity(metrics.govApproval)}
        />
        <MetricCard
          label="Int. Rate"
          value={`${metrics.interestRate.toFixed(2)}%`}
          trend="neutral"
          severity="neutral"
        />
      </div>
    </div>
  );
}
