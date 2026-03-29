"use client";

import { useEffect, useRef } from "react";

type Severity = "good" | "warn" | "bad" | "neutral";

const SEVERITY_HEX: Record<Severity, string> = {
  good: "#3E7C34", // Forest Green
  warn: "#C97D1A", // Autumn Orange
  bad: "#B83A52", // Berry Red
  neutral: "#5A8DB8", // Sky Blue
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
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (vals.length < 1) {
        ctx.restore();
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      let yMin = Math.min(...vals);
      let yMax = Math.max(...vals);

      if (domain) {
        yMin = Math.min(yMin, domain[0]);
        yMax = Math.max(yMax, domain[1]);
      }

      const range = yMax - yMin;
      const padding = range * 0.15 || 1;
      yMin -= padding;
      yMax += padding;

      if (bl !== undefined) {
        yMin = Math.min(yMin, bl - padding * 0.5);
        yMax = Math.max(yMax, bl + padding * 0.5);
      }

      const scaleY = (v: number) =>
        PAD_TOP + ((yMax - v) / (yMax - yMin)) * (H - PAD_TOP - PAD_BOT);

      // Baseline reference line
      if (bl !== undefined) {
        const by = scaleY(bl);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "#C4A46C";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, by);
        ctx.lineTo(W, by);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (vals.length === 1) {
        const y = scaleY(vals[0]);
        const pulse = Math.sin(now / 400) * 0.4 + 0.6;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4 * pulse;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(W / 2, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const step = W / (vals.length - 1);
      const points: [number, number][] = vals.map((v, i) => [
        i * step,
        scaleY(v),
      ]);

      // Area fill gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `${color}33`);
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
      ctx.shadowColor = color;
      ctx.shadowBlur = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Dot on latest point
      const last = points[points.length - 1];
      const pulse = Math.sin(now / 400) * 0.4 + 0.6;
      ctx.shadowColor = color;
      ctx.shadowBlur = 4 * pulse;
      ctx.fillStyle = "#FDF5E6";
      ctx.beginPath();
      ctx.arc(last[0], last[1], 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outer ring
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
    <div
      className="px-2 py-1.5 last:border-b-0"
      style={{ borderBottom: "1px solid #E8D5A3" }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-[9px] font-mono uppercase tracking-widest"
          style={{ color: "#8B7355" }}
        >
          {label}
        </span>
        <span
          className="text-[11px] font-mono font-bold tabular-nums"
          style={{ color: severityColor }}
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
