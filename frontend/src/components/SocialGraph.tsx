"use client";

import * as d3 from "d3";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BackendInfluenceEvent,
  BackendNPC,
  BackendRelationship,
  BackendRelType,
} from "@/types/backend";

// ── Color palette ──────────────────────────────────────────

const EDGE_COLORS: Record<BackendRelType, string> = {
  family: "#a855f7",
  friend: "#4ade80",
  employer: "#f59e0b",
  colleague: "#06b6d4",
  neighbor: "rgba(255,255,255,0.25)",
};

const EDGE_LABELS: Record<BackendRelType, string> = {
  family: "Family",
  friend: "Friend",
  employer: "Employer",
  colleague: "Colleague",
  neighbor: "Neighbor",
};

const MOOD_COLORS: Record<string, string> = {
  angry: "#f43f5e",
  anxious: "#fb923c",
  worried: "#facc15",
  neutral: "rgba(255,255,255,0.2)",
  hopeful: "#4ade80",
  excited: "#a78bfa",
};

const BEHAVIOR_COLORS: Record<string, string> = {
  keep: "rgba(255,255,255,0.2)",
  compromise: "#f59e0b",
  adopt: "#a855f7",
};

function politicalColor(leaning: number): string {
  const t = (leaning + 1) / 2;
  if (t <= 0.5) {
    return d3.interpolateRgb("#14b8a6", "#a855f7")(t / 0.5);
  }
  return d3.interpolateRgb("#a855f7", "#ec4899")((t - 0.5) / 0.5);
}

function roleColor(role: string): string {
  switch (role) {
    case "worker":
    case "farmer":
      return "#14b8a6";
    case "business_owner":
    case "shopkeeper":
      return "#f59e0b";
    case "politician":
      return "#a855f7";
    case "retiree":
      return "#6b7280";
    case "activist":
      return "#ec4899";
    case "student":
      return "#06b6d4";
    case "driver":
      return "#f97316";
    default:
      return "#8b5cf6";
  }
}

// ── Types ──────────────────────────────────────────────────

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  role: string;
  political_leaning: number;
  mood: string;
  // animation state
  flashUntil: number;
  connectionCount: number;
  charIndex: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  rel_type: BackendRelType;
  strength: number;
  sourceId: string;
  targetId: string;
  lastActiveTime: number;
}

interface Pulse {
  sourceId: string;
  targetId: string;
  behavior: string;
  startTime: number;
}

interface Props {
  npcs: BackendNPC[];
  relationships: BackendRelationship[];
  influenceEvents: BackendInfluenceEvent[];
  version: number;
}

const PULSE_DURATION = 1000;
const NODE_BASE_RADIUS = 7;
const NODE_MAX_RADIUS = 13;
const EDGE_ACTIVE_DECAY = 2000; // ms an edge stays "active" after a pulse

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
  const spritesheetRef = useRef<HTMLImageElement | null>(null);
  const zoomRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [dims, setDims] = useState({ w: 680, h: 500 });

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

  // Load NPC spritesheet once on mount
  useEffect(() => {
    const img = new Image();
    img.src = "/assets/tilesets/tilemap_packed.png";
    img.onload = () => {
      spritesheetRef.current = img;
    };
  }, []);

  // Resize canvas with DPR + attach zoom
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

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event: d3.D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        zoomRef.current = event.transform;
      });
    d3.select(canvas).call(zoom);
    zoomBehaviorRef.current = zoom;
  }, [dims]);

  // Build / update simulation
  useEffect(() => {
    if (npcs.length === 0) return;

    const existingPositions = new Map<string, { x: number; y: number }>();
    for (const n of nodesRef.current) {
      if (n.x != null && n.y != null) {
        existingPositions.set(n.id, { x: n.x, y: n.y });
      }
    }

    // Count connections per node
    const connCount = new Map<string, number>();
    for (const r of relationships) {
      connCount.set(r.source_id, (connCount.get(r.source_id) || 0) + 1);
      connCount.set(r.target_id, (connCount.get(r.target_id) || 0) + 1);
    }

    const nodes: GraphNode[] = npcs.map((npc, i) => {
      const prev = existingPositions.get(npc.id);
      return {
        id: npc.id,
        name: npc.name,
        role: npc.role,
        political_leaning: npc.political_leaning,
        mood: npc.mood,
        flashUntil: 0,
        connectionCount: connCount.get(npc.id) || 0,
        charIndex: i % 16,
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
        lastActiveTime: 0,
      }));

    nodesRef.current = nodes;
    linksRef.current = links;

    if (simRef.current) simRef.current.stop();

    const sim = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((l) => 60 + (1 - l.strength) * 40)
          .strength((l) => 0.2 + l.strength * 0.3),
      )
      .force("charge", d3.forceManyBody().strength(-80).distanceMax(200))
      .force("center", d3.forceCenter(dims.w / 2, dims.h / 2).strength(0.05))
      .force(
        "collide",
        d3.forceCollide<GraphNode>((d) => nodeRadius(d) + 6),
      )
      .force("x", d3.forceX(dims.w / 2).strength(0.02))
      .force("y", d3.forceY(dims.h / 2).strength(0.02))
      .alphaDecay(0.015)
      .velocityDecay(0.35);

    simRef.current = sim;
    return () => {
      sim.stop();
    };
  }, [npcs, relationships, dims.w, dims.h]);

  // Update node data without rebuilding simulation
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
    simRef.current.alpha(0.08).restart();
  }, [version, npcs]);

  // Spawn influence pulses + mark edges/nodes active
  useEffect(() => {
    if (influenceEvents.length === 0) return;
    const now = performance.now();
    const linkLookup = new Map<string, GraphLink>();
    for (const l of linksRef.current) {
      linkLookup.set(`${l.sourceId}-${l.targetId}`, l);
      linkLookup.set(`${l.targetId}-${l.sourceId}`, l);
    }
    const nodeLookup = new Map<string, GraphNode>();
    for (const n of nodesRef.current) nodeLookup.set(n.id, n);

    const newPulses: Pulse[] = [];
    for (let i = 0; i < influenceEvents.length; i++) {
      const ev = influenceEvents[i];
      newPulses.push({
        sourceId: ev.speaker_id,
        targetId: ev.target_id,
        behavior: ev.behavior,
        startTime: now + i * 150,
      });
      // Mark edge as recently active
      const link = linkLookup.get(`${ev.speaker_id}-${ev.target_id}`);
      if (link) link.lastActiveTime = now + i * 150 + PULSE_DURATION;
      // Flash target node
      const target = nodeLookup.get(ev.target_id);
      if (target) target.flashUntil = now + i * 150 + PULSE_DURATION + 400;
    }
    pulsesRef.current = [...pulsesRef.current, ...newPulses];
  }, [influenceEvents]);

  // ── Draw loop ────────────────────────────────────────────

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

    // Deep purple background gradient (fixed, not zoomed)
    const bgGrad = ctx.createRadialGradient(
      dims.w / 2,
      dims.h / 2,
      0,
      dims.w / 2,
      dims.h / 2,
      dims.w * 0.6,
    );
    bgGrad.addColorStop(0, "#0d0020");
    bgGrad.addColorStop(1, "#060010");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, dims.w, dims.h);

    // Apply zoom transform
    ctx.save();
    ctx.translate(zoomRef.current.x, zoomRef.current.y);
    ctx.scale(zoomRef.current.k, zoomRef.current.k);

    // Node position lookup
    const posMap = new Map<string, { x: number; y: number }>();
    for (const n of nodes) posMap.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });

    // Connected nodes for hovered state
    const hovConnected = new Set<string>();
    if (hovId) {
      hovConnected.add(hovId);
      for (const l of links) {
        if (l.sourceId === hovId) hovConnected.add(l.targetId);
        if (l.targetId === hovId) hovConnected.add(l.sourceId);
      }
    }

    // ── Edges ──────────────────────────────────────────────

    for (const link of links) {
      const s = posMap.get(link.sourceId);
      const t = posMap.get(link.targetId);
      if (!s || !t) continue;

      const isHighlighted =
        hovId && (link.sourceId === hovId || link.targetId === hovId);
      const isDimmed = hovId && !isHighlighted;
      const isRecentlyActive = link.lastActiveTime > now;
      const activeDecay = isRecentlyActive
        ? Math.min(1, (link.lastActiveTime - now) / EDGE_ACTIVE_DECAY)
        : 0;

      const baseWidth = 0.5 + link.strength * 2;
      const baseAlpha = 0.2 + link.strength * 0.4;

      ctx.beginPath();

      // Curved edges for visual appeal
      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const curvature = 0.08;
      const cx = mx + dy * curvature;
      const cy = my - dx * curvature;

      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(cx, cy, t.x, t.y);

      if (link.rel_type === "neighbor") {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }

      if (isRecentlyActive) {
        ctx.shadowColor = EDGE_COLORS[link.rel_type];
        ctx.shadowBlur = 6 * activeDecay;
      }

      ctx.globalAlpha = isDimmed
        ? 0.06
        : isHighlighted
          ? 0.95
          : isRecentlyActive
            ? baseAlpha + 0.3 * activeDecay
            : baseAlpha;
      ctx.strokeStyle = EDGE_COLORS[link.rel_type];
      ctx.lineWidth = isHighlighted
        ? baseWidth + 1.5
        : isRecentlyActive
          ? baseWidth + activeDecay
          : baseWidth;
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;

      // Edge label on hover
      if (isHighlighted && dist > 40) {
        ctx.globalAlpha = 0.8;
        ctx.font = "7px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = EDGE_COLORS[link.rel_type];
        const labelX = cx;
        const labelY = cy - 5;
        ctx.fillText(
          `${EDGE_LABELS[link.rel_type]} (${Math.round(link.strength * 100)}%)`,
          labelX,
          labelY,
        );
        ctx.globalAlpha = 1.0;
      }
    }

    // ── Influence pulses ───────────────────────────────────

    pulsesRef.current = pulsesRef.current.filter((p) => {
      const elapsed = now - p.startTime;
      if (elapsed < 0) return true;
      const t = elapsed / PULSE_DURATION;
      if (t > 1) return false;

      const s = posMap.get(p.sourceId);
      const e = posMap.get(p.targetId);
      if (!s || !e) return false;

      // Ease-out for deceleration effect
      const eased = 1 - (1 - t) * (1 - t);
      const px = s.x + (e.x - s.x) * eased;
      const py = s.y + (e.y - s.y) * eased;
      const color = BEHAVIOR_COLORS[p.behavior] || "#a855f7";
      const fade = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1;
      const pulseSize =
        p.behavior === "adopt" ? 5 : p.behavior === "compromise" ? 4 : 2.5;

      // Outer glow
      ctx.globalAlpha = fade * 0.4;
      ctx.beginPath();
      ctx.arc(px, py, pulseSize + 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner core
      ctx.globalAlpha = fade * 0.9;
      ctx.beginPath();
      ctx.arc(px, py, pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // Trail particles
      if (p.behavior !== "keep") {
        for (let i = 1; i <= 3; i++) {
          const tt = Math.max(0, eased - i * 0.04);
          const tpx = s.x + (e.x - s.x) * tt;
          const tpy = s.y + (e.y - s.y) * tt;
          ctx.globalAlpha = fade * 0.15 * (1 - i / 4);
          ctx.beginPath();
          ctx.arc(tpx, tpy, pulseSize * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
      return true;
    });

    // ── Nodes ──────────────────────────────────────────────

    for (const node of nodes) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const isHov = hovId === node.id;
      const isDimmed = hovId && !hovConnected.has(node.id);
      const isFlashing = node.flashUntil > now;
      const flashIntensity = isFlashing
        ? Math.sin(((node.flashUntil - now) / 400) * Math.PI * 3) * 0.5 + 0.5
        : 0;

      const r = nodeRadius(node);
      const hovR = isHov ? r + 3 : r;

      ctx.globalAlpha = isDimmed ? 0.15 : 1.0;

      // Ambient glow for hovered / flashing nodes
      if ((isHov || isFlashing) && !isDimmed) {
        const glowColor = isHov
          ? "#a855f7"
          : MOOD_COLORS[node.mood] || "#a855f7";
        const glowR = hovR + (isFlashing ? 10 + flashIntensity * 6 : 8);
        const glow = ctx.createRadialGradient(x, y, hovR, x, y, glowR);
        glow.addColorStop(0, `${glowColor}40`);
        glow.addColorStop(1, `${glowColor}00`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Mood ring (outer arc segments instead of solid ring)
      const moodColor = MOOD_COLORS[node.mood] || "rgba(255,255,255,0.2)";
      ctx.strokeStyle = moodColor;
      ctx.lineWidth = 2;
      const segments = 6;
      const gap = 0.15;
      for (let i = 0; i < segments; i++) {
        const start = (i / segments) * Math.PI * 2 - Math.PI / 2;
        const end = ((i + 1) / segments) * Math.PI * 2 - Math.PI / 2 - gap;
        ctx.beginPath();
        ctx.arc(x, y, hovR + 3, start, end);
        ctx.stroke();
      }

      // Node fill — gradient sphere effect (semi-transparent so sprite shows through)
      const grad = ctx.createRadialGradient(
        x - r * 0.3,
        y - r * 0.3,
        r * 0.1,
        x,
        y,
        hovR,
      );
      const baseColor = roleColor(node.role);
      const lighterColor = d3.interpolateRgb(baseColor, "#fff")(0.35);
      grad.addColorStop(0, lighterColor);
      grad.addColorStop(0.7, baseColor);
      grad.addColorStop(1, d3.interpolateRgb(baseColor, "#000")(0.25));

      ctx.globalAlpha = isDimmed ? 0.15 : 0.4;
      ctx.beginPath();
      ctx.arc(x, y, hovR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.globalAlpha = isDimmed ? 0.15 : 1.0;

      // Draw NPC sprite clipped to node circle
      const sheet = spritesheetRef.current;
      if (sheet) {
        const charIdx = node.charIndex;
        const srcX = (23 + (charIdx % 4)) * 16;
        const srcY = (14 + Math.floor(charIdx / 4)) * 16;
        const drawSize = hovR * 1.6;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, hovR, 0, Math.PI * 2);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          sheet,
          srcX, srcY, 16, 16,
          x - drawSize / 2,
          y - drawSize / 2,
          drawSize, drawSize,
        );
        ctx.restore();
      }

      // Thin crisp border
      ctx.strokeStyle = isHov ? "rgba(168,85,247,0.8)" : "rgba(255,255,255,0.15)";
      ctx.lineWidth = isHov ? 1.5 : 0.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = isDimmed ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.85)";
      ctx.font = `${isHov ? "bold 10px" : "8px"} monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      // Text shadow for readability
      if (!isDimmed) {
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
      }
      ctx.fillText(node.name.split(" ")[0].toUpperCase(), x, y + hovR + 5);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      ctx.globalAlpha = 1.0;
    }

    ctx.restore();

    // ── Legend (fixed position, not affected by zoom) ──────
    drawLegend(ctx, dims.w);

    rafRef.current = requestAnimationFrame(draw);
  }, [dims]);

  // Start/stop draw loop
  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  // ── Mouse interaction ────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /** Transform screen coords to graph coords (accounting for zoom) */
    function screenToGraph(sx: number, sy: number): [number, number] {
      return zoomRef.current.invert([sx, sy]) as [number, number];
    }

    function getNodeAt(mx: number, my: number): GraphNode | null {
      const [gx, gy] = screenToGraph(mx, my);
      for (const n of nodesRef.current) {
        const dx = (n.x ?? 0) - gx;
        const dy = (n.y ?? 0) - gy;
        if (dx * dx + dy * dy < (nodeRadius(n) + 6) ** 2) return n;
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
        const [gx, gy] = screenToGraph(x, y);
        dragRef.current.fx = gx;
        dragRef.current.fy = gy;
        simRef.current?.alpha(0.3).restart();
        return;
      }
      const node = getNodeAt(x, y);
      hoveredRef.current = node?.id ?? null;
      setHovered(node ?? null);
      canvas!.style.cursor = node ? "grab" : "default";
    };

    const onDown = (e: MouseEvent) => {
      const { x, y } = getMousePos(e);
      const node = getNodeAt(x, y);
      if (node) {
        dragRef.current = node;
        const [gx, gy] = screenToGraph(x, y);
        node.fx = gx;
        node.fy = gy;
        canvas!.style.cursor = "grabbing";
        simRef.current?.alphaTarget(0.3).restart();
      }
    };

    const onUp = () => {
      if (dragRef.current) {
        dragRef.current.fx = null;
        dragRef.current.fy = null;
        dragRef.current = null;
        canvas!.style.cursor = "default";
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

  // ── Tooltip ──────────────────────────────────────────────

  const hovNode = hovered;
  const hovLinks = hovNode
    ? linksRef.current.filter(
        (l) => l.sourceId === hovNode.id || l.targetId === hovNode.id,
      )
    : [];

  const resetZoom = useCallback(() => {
    const canvas = canvasRef.current;
    const zoom = zoomBehaviorRef.current;
    if (canvas && zoom) {
      d3.select(canvas).call(zoom.transform, d3.zoomIdentity);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <button
        type="button"
        onClick={resetZoom}
        className="absolute top-2 left-2 z-10 rounded border border-white/20 bg-[#060010]/90 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-white/50 hover:text-white/80 hover:border-purple-500/50 transition-colors"
      >
        Reset Zoom
      </button>

      {hovNode && (
        <div
          className="pointer-events-none absolute z-50"
          style={{
            left: Math.min(zoomRef.current.applyX(hovNode.x ?? 0) + 18, dims.w - 180),
            top: Math.max(zoomRef.current.applyY(hovNode.y ?? 0) - 20, 4),
          }}
        >
          <div className="rounded-md bg-[#060010]/95 border border-white/20 px-3 py-2 shadow-xl backdrop-blur-sm min-w-[140px] neon-border-purple">
            {/* Name & role */}
            <div className="text-[10px] font-pixel text-purple-400 neon-text-purple">
              {hovNode.name}
            </div>
            <div className="text-[8px] font-mono text-white/40 uppercase tracking-widest mt-0.5">
              {(hovNode.role ?? "").replace("_", " ")}
            </div>

            {/* Stats row */}
            <div className="mt-2 flex items-center gap-3 text-[9px] font-mono">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: MOOD_COLORS[hovNode.mood] || "#818cf8" }}
                />
                <span 
                  className={hovNode.mood === 'angry' ? 'neon-text-pink' : 
                             (hovNode.mood === 'anxious' || hovNode.mood === 'worried') ? 'neon-text-yellow' :
                             hovNode.mood === 'hopeful' ? 'neon-text-teal' :
                             hovNode.mood === 'excited' ? 'neon-text-purple' : 'neon-text-indigo'}
                  style={{ color: MOOD_COLORS[hovNode.mood] || "#818cf8" }}
                >
                  {hovNode.mood}
                </span>
              </span>
              <span
                className={hovNode.political_leaning > 0.3 ? "neon-text-pink" : hovNode.political_leaning < -0.3 ? "neon-text-teal" : "neon-text-indigo"}
                style={{ color: politicalColor(hovNode.political_leaning) }}
              >
                {hovNode.political_leaning > 0.3
                  ? "CONSERVATIVE"
                  : hovNode.political_leaning < -0.3
                    ? "PROGRESSIVE"
                    : "MODERATE"}
              </span>
            </div>

            {/* Connections */}
            {hovLinks.length > 0 && (
              <div className="mt-2 border-t border-white/10 pt-2">
                <div className="text-[8px] font-pixel text-purple-400/40 uppercase mb-1">
                  Connections ({hovLinks.length})
                </div>
                {hovLinks.slice(0, 4).map((l) => {
                  const otherId =
                    l.sourceId === hovNode.id ? l.targetId : l.sourceId;
                  const other = nodesRef.current.find((n) => n.id === otherId);
                  return (
                    <div
                      key={`${l.sourceId}-${l.targetId}-${l.rel_type}`}
                      className="flex items-center gap-1.5 text-[8px] font-mono leading-relaxed"
                    >
                      <span
                        className="inline-block h-1.5 w-3 rounded-sm"
                        style={{ background: EDGE_COLORS[l.rel_type] }}
                      />
                      <span className="text-white/60">
                        {other?.name.split(" ")[0] ?? "?"}
                      </span>
                      <span className="text-white/20 uppercase tracking-tighter">{l.rel_type}</span>
                    </div>
                  );
                })}
                {hovLinks.length > 4 && (
                  <div className="text-[8px] font-mono text-white/20 mt-1 uppercase">
                    +{hovLinks.length - 4} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────

function nodeRadius(node: GraphNode): number {
  // Scale radius by connection count
  const t = Math.min(node.connectionCount / 6, 1);
  return NODE_BASE_RADIUS + t * (NODE_MAX_RADIUS - NODE_BASE_RADIUS);
}

// ── Legend ──────────────────────────────────────────────────

function drawLegend(ctx: CanvasRenderingContext2D, canvasW: number) {
  const x = canvasW - 112;
  let y = 8;
  const lh = 13;
  const w = 104;
  const h = 105;

  // Background
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(6,0,16,0.9)";
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(168,85,247,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1.0;

  // Title
  ctx.font = "bold 7px monospace";
  ctx.fillStyle = "rgba(168, 85, 247, 0.6)";
  ctx.textAlign = "left";
  y += 11;
  ctx.fillText("RELATIONSHIPS", x + 6, y);
  y += lh + 1;

  ctx.font = "7px monospace";
  const types: [BackendRelType, string][] = [
    ["family", "Family"],
    ["friend", "Friend"],
    ["employer", "Employer"],
    ["colleague", "Colleague"],
    ["neighbor", "Neighbor"],
  ];

  for (const [type, label] of types) {
    ctx.beginPath();
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + 20, y);
    if (type === "neighbor") ctx.setLineDash([2, 2]);
    ctx.strokeStyle = EDGE_COLORS[type];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.fillText(label, x + 24, y + 3);
    y += lh;
  }

  // Political spectrum
  y += 3;
  const specW = w - 16;
  for (let i = 0; i < specW; i++) {
    const t = i / (specW - 1);
    ctx.fillStyle = politicalColor(t * 2 - 1);
    ctx.fillRect(x + 8 + i, y, 1, 5);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "6px monospace";
  ctx.textAlign = "left";
  ctx.fillText("PROG", x + 6, y + 13);
  ctx.textAlign = "right";
  ctx.fillText("CONS", x + w - 6, y + 13);
  ctx.textAlign = "left";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
