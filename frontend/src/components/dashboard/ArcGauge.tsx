"use client";

import { useAnimatedValue } from "@/hooks/useAnimatedValue";

type Severity = "good" | "warn" | "bad" | "neutral";

const SEVERITY_HEX: Record<Severity, string> = {
  good: "#5ab85a",
  warn: "#e8a43a",
  bad: "#d45050",
  neutral: "#d4c4a0",
};

interface ArcGaugeProps {
  label: string;
  value: number; // 0-1
  formatValue: (v: number) => string;
  severity: Severity;
}

const RADIUS = 32;
const STROKE = 6;
const SVG_W = 196;
const SVG_H = 56;
const CX = SVG_W / 2;
const CY = SVG_H - 6;

// Semi-circle arc length
const ARC_LEN = Math.PI * RADIUS;

export function ArcGauge({
  label,
  value,
  formatValue,
  severity,
}: ArcGaugeProps) {
  const animatedValue = useAnimatedValue(Math.max(0, Math.min(1, value)));
  const color = SEVERITY_HEX[severity];
  const dashOffset = ARC_LEN * (1 - animatedValue);
  const isBad = severity === "bad";

  return (
    <div className="border-b border-[#3a2e1e] px-2 py-2 last:border-b-0">
      <span className="text-[10px] font-mono uppercase text-[#8a7a62] block mb-1">
        {label}
      </span>

      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="block"
        role="img"
        aria-label={`${label} gauge: ${formatValue(animatedValue)}`}
      >
        {/* Glow filter for danger state */}
        <defs>
          <filter id={`glow-${label.replace(/\s+/g, "-")}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <path
          d={describeArc(CX, CY, RADIUS, 180, 360)}
          fill="none"
          stroke="#2a2218"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Filled arc */}
        <path
          d={describeArc(CX, CY, RADIUS, 180, 360)}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={dashOffset}
          style={{
            transition:
              "stroke-dashoffset 600ms cubic-bezier(0.4, 0, 0.2, 1), stroke 300ms",
          }}
          filter={
            isBad ? `url(#glow-${label.replace(/\s+/g, "-")})` : undefined
          }
          className={isBad ? "gauge-glow" : undefined}
        />

        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const angle = Math.PI + t * Math.PI;
          const innerR = RADIUS - STROKE / 2 - 2;
          const outerR = RADIUS - STROKE / 2 - 5;
          return (
            <line
              key={t}
              x1={CX + Math.cos(angle) * innerR}
              y1={CY + Math.sin(angle) * innerR}
              x2={CX + Math.cos(angle) * outerR}
              y2={CY + Math.sin(angle) * outerR}
              stroke="#3a2e1e"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Value text */}
        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          fill={color}
          fontSize="14"
          fontFamily="monospace"
          fontWeight="bold"
          style={{ transition: "fill 300ms" }}
        >
          {formatValue(animatedValue)}
        </text>
      </svg>
    </div>
  );
}

/**
 * Describe a semi-circular arc path from startAngle to endAngle (in degrees).
 * 0 degrees = right, 180 = left. We draw from 180 (left) to 360 (right).
 */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}
