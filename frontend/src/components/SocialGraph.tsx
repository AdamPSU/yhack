"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type {
  BackendInfluenceEvent,
  BackendNPC,
  BackendRelationship,
  BackendRelType,
} from "@/types/backend";

// ── Color palette (matches RPG theme) ──────────────────────

const EDGE_COLORS: Record<BackendRelType, string> = {
  family: "#e8a43a",
  friend: "#5ab85a",
  employer: "#50a0d4",
  colleague: "#6a5a42",
  neighbor: "#3a2e1e",
};

const MOOD_COLORS: Record<string, string> = {
  angry: "#d45050",
  anxious: "#e87840",
  worried: "#e8a43a",
  neutral: "#8a7a62",
  hopeful: "#5ab85a",
  excited: "#e8c840",
};

const BEHAVIOR_COLORS: Record<string, string> = {
  keep: "#3a2e1e",
  compromise: "#e8a43a",
  adopt: "#f0e6d2",
};

function politicalColor(leaning: number): string {
  // -1 (progressive/blue) → 0 (neutral) → +1 (conservative/red)
  const t = (leaning + 1) / 2; // normalize to 0..1
  if (t <= 0.5) {
    // blue to neutral
    const s = t / 0.5;
    return d3.interpolateRgb("#50a0d4", "#c4b490")(s);
  }
  // neutral to red
  const s = (t - 0.5) / 0.5;
  return d3.interpolateRgb("#c4b490", "#d45050")(s);
}

// ── Types ──────────────────────────────────────────────────

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  role: string;
  political_leaning: number;
  mood: string;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  rel_type: BackendRelType;
  strength: number;
  sourceId: string;
  targetId: string;
}

interface Pulse {
  sourceId: string;
  targetId: string;
  behavior: string;
  progress: number; // 0..1
  startTime: number;
}

interface Props {
  npcs: BackendNPC[];
  relationships: BackendRelationship[];
  influenceEvents: BackendInfluenceEvent[];
  version: number;
}

const PULSE_DURATION = 800;
const NODE_RADIUS = 8;

export function SocialGraph({
  npcs,
  relationships,
  influenceEvents,
  version,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const pulsesRef = useRef<Pulse[]>([]);
  const rafRef = useRef<number>(0);
  const hoveredRef = useRef<string | null>(null);
  const dragRef = useRef<GraphNode | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [dims, setDims] = useState({ w: 248, h: 600 });

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dims.w * dpr;
    canvas.height = dims.h * dpr;
    canvas.style.width = `${dims.w}px`;
    canvas.style.height = `${dims.h}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, [dims]);

  // Build / update simulation when data changes
  useEffect(() => {
    if (npcs.length === 0) return;

    const existingPositions = new Map<string, { x: number; y: number }>();
    for (const n of nodesRef.current) {
      if (n.x != null && n.y != null) {
        existingPositions.set(n.id, { x: n.x, y: n.y });
      }
    }

    const nodes: GraphNode[] = npcs.map((npc) => {
      const prev = existingPositions.get(npc.id);
      return {
        id: npc.id,
        name: npc.name,
        role: npc.role,
        political_leaning: npc.political_leaning,
        mood: npc.mood,
        ...(prev || {}),
      };
    });

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = relationships
      .filter((r) => nodeIds.has(r.source_id) && nodeIds.has(r.target_id))
      .map((r) => ({
        source: r.source_id,
        target: r.target_id,
        rel_type: r.rel_type,
        strength: r.strength,
        sourceId: r.source_id,
        targetId: r.target_id,
      }));

    nodesRef.current = nodes;
    linksRef.current = links;

    if (simRef.current) {
      simRef.current.stop();
    }

    const sim = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(50)
          .strength(0.3),
      )
      .force("charge", d3.forceManyBody().strength(-60))
      .force("center", d3.forceCenter(dims.w / 2, dims.h / 2))
      .force("collide", d3.forceCollide(NODE_RADIUS + 4))
      .force("x", d3.forceX(dims.w / 2).strength(0.03))
      .force("y", d3.forceY(dims.h / 2).strength(0.03))
      .alphaDecay(0.02);

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [npcs, relationships, dims.w, dims.h]);

  // Update node data (political_leaning, mood) without rebuilding simulation
  useEffect(() => {
    if (!simRef.current) return;
    const lookup = new Map(npcs.map((n) => [n.id, n]));
    for (const node of nodesRef.current) {
      const npc = lookup.get(node.id);
      if (npc) {
        node.political_leaning = npc.political_leaning;
        node.mood = npc.mood;
      }
    }
    // Gently reheat to settle any layout shifts
    simRef.current.alpha(0.1).restart();
  }, [version, npcs]);

  // Spawn influence pulses
  useEffect(() => {
    if (influenceEvents.length === 0) return;
    const now = performance.now();
    const newPulses: Pulse[] = influenceEvents.map((ev, i) => ({
      sourceId: ev.speaker_id,
      targetId: ev.target_id,
      behavior: ev.behavior,
      progress: 0,
      startTime: now + i * 120, // stagger slightly
    }));
    pulsesRef.current = [...pulsesRef.current, ...newPulses];
  }, [influenceEvents]);

  // Canvas draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const hovId = hoveredRef.current;

    ctx.clearRect(0, 0, dims.w, dims.h);

    // Build node position lookup
    const posMap = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      posMap.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    }

    // Draw edges
    for (const link of links) {
      const s = posMap.get(link.sourceId);
      const t = posMap.get(link.targetId);
      if (!s || !t) continue;

      const isHighlighted =
        hovId && (link.sourceId === hovId || link.targetId === hovId);
      const isDimmed = hovId && !isHighlighted;

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);

      if (link.rel_type === "neighbor") {
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
      }

      const baseAlpha = 0.3 + link.strength * 0.5;
      ctx.globalAlpha = isDimmed ? 0.08 : isHighlighted ? 1.0 : baseAlpha;
      ctx.strokeStyle = EDGE_COLORS[link.rel_type] || "#6a5a42";
      ctx.lineWidth = isHighlighted
        ? 2 + link.strength * 3
        : 0.5 + link.strength * 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    }

    // Draw influence pulses
    pulsesRef.current = pulsesRef.current.filter((p) => {
      const elapsed = now - p.startTime;
      if (elapsed < 0) return true; // not started yet
      const t = elapsed / PULSE_DURATION;
      if (t > 1) return false; // done

      const s = posMap.get(p.sourceId);
      const e = posMap.get(p.targetId);
      if (!s || !e) return false;

      const px = s.x + (e.x - s.x) * t;
      const py = s.y + (e.y - s.y) * t;
      const color = BEHAVIOR_COLORS[p.behavior] || "#e8a43a";

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      return true;
    });

    // Draw nodes
    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const isHov = hovId === node.id;
      const isDimmed =
        hovId &&
        !isHov &&
        !links.some(
          (l) =>
            (l.sourceId === hovId && l.targetId === node.id) ||
            (l.targetId === hovId && l.sourceId === node.id),
        );

      const r = isHov ? NODE_RADIUS + 3 : NODE_RADIUS;
      ctx.globalAlpha = isDimmed ? 0.25 : 1.0;

      // Mood ring
      ctx.beginPath();
      ctx.arc(x, y, r + 2, 0, Math.PI * 2);
      ctx.fillStyle = MOOD_COLORS[node.mood] || "#8a7a62";
      ctx.fill();

      // Node fill
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = politicalColor(node.political_leaning);
      ctx.fill();

      if (isHov) {
        ctx.strokeStyle = "#f0e6d2";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Label
      ctx.fillStyle = isDimmed ? "#3a2e1e" : "#c4b490";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(node.name.split(" ")[0], x, y + r + 11);

      ctx.globalAlpha = 1.0;
    }

    // Legend (top-left)
    drawLegend(ctx);

    rafRef.current = requestAnimationFrame(draw);
  }, [dims]);

  // Start/stop draw loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function getNodeAt(mx: number, my: number): GraphNode | null {
      for (const n of nodesRef.current) {
        const dx = (n.x ?? 0) - mx;
        const dy = (n.y ?? 0) - my;
        if (dx * dx + dy * dy < (NODE_RADIUS + 4) ** 2) return n;
      }
      return null;
    }

    function getMousePos(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    const onMove = (e: MouseEvent) => {
      const { x, y } = getMousePos(e);

      if (dragRef.current) {
        dragRef.current.fx = x;
        dragRef.current.fy = y;
        simRef.current?.alpha(0.3).restart();
        return;
      }

      const node = getNodeAt(x, y);
      hoveredRef.current = node?.id ?? null;
      setHovered(node ?? null);
      canvas!.style.cursor = node ? "pointer" : "default";
    };

    const onDown = (e: MouseEvent) => {
      const { x, y } = getMousePos(e);
      const node = getNodeAt(x, y);
      if (node) {
        dragRef.current = node;
        node.fx = x;
        node.fy = y;
        simRef.current?.alphaTarget(0.3).restart();
      }
    };

    const onUp = () => {
      if (dragRef.current) {
        dragRef.current.fx = null;
        dragRef.current.fy = null;
        dragRef.current = null;
        simRef.current?.alphaTarget(0);
      }
    };

    const onLeave = () => {
      hoveredRef.current = null;
      setHovered(null);
      if (dragRef.current) {
        dragRef.current.fx = null;
        dragRef.current.fy = null;
        dragRef.current = null;
        simRef.current?.alphaTarget(0);
      }
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-50"
          style={{
            left: Math.min((hovered.x ?? 0) + 14, dims.w - 130),
            top: Math.max((hovered.y ?? 0) - 40, 4),
          }}
        >
          <div className="rounded bg-[#1a1510]/95 border border-[#4a3c2a] px-2 py-1.5 shadow-lg">
            <div className="text-[10px] font-mono font-bold text-[#e8a43a]">
              {hovered.name}
            </div>
            <div className="text-[9px] font-mono text-[#8a7a62]">
              {hovered.role}
            </div>
            <div className="mt-1 flex gap-2 text-[9px] font-mono">
              <span style={{ color: MOOD_COLORS[hovered.mood] || "#8a7a62" }}>
                {hovered.mood}
              </span>
              <span
                style={{ color: politicalColor(hovered.political_leaning) }}
              >
                {hovered.political_leaning > 0.3
                  ? "conservative"
                  : hovered.political_leaning < -0.3
                    ? "progressive"
                    : "moderate"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Legend ──────────────────────────────────────────────────

function drawLegend(ctx: CanvasRenderingContext2D) {
  const x = 6;
  let y = 6;
  const lh = 11;

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#1a1510";
  ctx.fillRect(x, y, 72, 76);
  ctx.strokeStyle = "#3a2e1e";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, 72, 76);
  ctx.globalAlpha = 1.0;

  ctx.font = "7px monospace";
  ctx.textAlign = "left";

  y += lh;
  const types: [BackendRelType, string][] = [
    ["family", "Family"],
    ["friend", "Friend"],
    ["employer", "Employer"],
    ["colleague", "Colleague"],
    ["neighbor", "Neighbor"],
  ];

  for (const [type, label] of types) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 16, y);
    if (type === "neighbor") ctx.setLineDash([2, 2]);
    ctx.strokeStyle = EDGE_COLORS[type];
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#8a7a62";
    ctx.fillText(label, x + 20, y + 3);
    y += lh;
  }

  // Political leaning spectrum
  y += 2;
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    ctx.fillStyle = politicalColor(t * 2 - 1);
    ctx.fillRect(x + 4 + i * 2, y, 2, 4);
  }
  ctx.fillStyle = "#8a7a62";
  ctx.font = "6px monospace";
  ctx.textAlign = "left";
  ctx.fillText("L", x + 2, y + 12);
  ctx.textAlign = "right";
  ctx.fillText("R", x + 66, y + 12);
  ctx.textAlign = "left";
}
