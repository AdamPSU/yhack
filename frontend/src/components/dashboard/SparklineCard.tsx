"use client";

import { useEffect, useRef } from "react";

type Severity = "good" | "warn" | "bad" | "neutral";

const SEVERITY_HEX: Record<Severity, string> = {
  good: "#5ab85a",
  warn: "#e8a43a",
  bad: "#d45050",
  neutral: "#d4c4a0",
};

interface SparklineCardProps {
  label: string;
  values: number[];
  currentValue: number;
  formatValue: (v: number) => string;
  severity: Severity;
  baseline?: number;
  domain?: [number, number];
}

export function SparklineCard({
  label,
  values,
  currentValue,
  formatValue,
  severity,
  baseline,
  domain,
}: SparklineCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const valuesRef = useRef(values);
  const severityRef = useRef(severity);
  const baselineRef = useRef(baseline);
  valuesRef.current = values;
  severityRef.current = severity;
  baselineRef.current = baseline;

  // Handle DPR
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = 196;
    const h = 40;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = 196;
    const H = 40;
    const PAD_TOP = 4;
    const PAD_BOT = 4;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const now = performance.now();
      const vals = valuesRef.current;
      const color = SEVERITY_HEX[severityRef.current];
      const bl = baselineRef.current;

      ctx.save();
      // Reset transform for clear (handle DPR)
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (vals.length < 1) {
        ctx.restore();
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Compute y domain
      let yMin: number;
      let yMax: number;
      if (domain) {
        [yMin, yMax] = domain;
      } else {
        yMin = Math.min(...vals);
        yMax = Math.max(...vals);
        const padding = (yMax - yMin) * 0.15 || 1;
        yMin -= padding;
        yMax += padding;
      }

      const scaleY = (v: number) =>
        PAD_TOP + ((yMax - v) / (yMax - yMin)) * (H - PAD_TOP - PAD_BOT);

      // Baseline reference line
      if (bl !== undefined) {
        const by = scaleY(bl);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "#3a2e1e";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, by);
        ctx.lineTo(W, by);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (vals.length === 1) {
        // Single point — draw a dot
        const y = scaleY(vals[0]);
        const pulse = Math.sin(now / 400) * 0.4 + 0.6;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6 * pulse;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(W / 2, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Build points
      const step = W / (vals.length - 1);
      const points: [number, number][] = vals.map((v, i) => [
        i * step,
        scaleY(v),
      ]);

      // Area fill gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `${color}33`); // 20% opacity
      grad.addColorStop(1, `${color}00`);

      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.lineTo(points[points.length - 1][0], H);
      ctx.lineTo(points[0][0], H);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();

      // Pulsing glow dot on latest point
      const last = points[points.length - 1];
      const pulse = Math.sin(now / 400) * 0.4 + 0.6;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 * pulse;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(last[0], last[1], 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outer glow ring
      ctx.globalAlpha = 0.3 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(last[0], last[1], 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [domain]);

  const severityColor = SEVERITY_HEX[severity];

  return (
    <div className="border-b border-[#3a2e1e] px-2 py-1.5 last:border-b-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono uppercase tracking-wider text-[#6a5a42]">
          {label}
        </span>
        <span
          className="text-[11px] font-mono font-bold tabular-nums"
          style={{ color: severityColor, textShadow: `0 0 6px ${severityColor}33` }}
        >
          {formatValue(currentValue)}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="block"
        style={{ width: 196, height: 40 }}
      />
    </div>
  );
}
