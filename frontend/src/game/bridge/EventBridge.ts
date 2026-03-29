import type { NPCHoverInfo, NPCState, SimEvent } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

/**
 * Singleton event bus bridging React ↔ Phaser.
 *
 * Uses a lightweight custom emitter instead of Phaser.Events.EventEmitter
 * so it can be imported safely during SSR (Phaser requires browser APIs).
 *
 * React side emits:
 *   sim:event        (SimEvent)       → Phaser receives and triggers game effects
 *   sim:phase-change ({phase, month}) → Phaser updates world state
 *
 * Phaser side emits:
 *   sim:npc-position (NPCState)       → React renders DOM chat bubbles
 */
class EventBridge {
  private static instance: EventBridge;
  private listeners = new Map<string, Set<{ fn: Listener; ctx: unknown }>>();

  private constructor() {}

  static getInstance(): EventBridge {
    if (!EventBridge.instance) {
      EventBridge.instance = new EventBridge();
    }
    return EventBridge.instance;
  }

  on(event: string, fn: Listener, context?: unknown) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add({ fn, ctx: context });
  }

  off(event: string, fn: Listener, context?: unknown) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const entry of set) {
      if (entry.fn === fn && entry.ctx === context) {
        set.delete(entry);
        break;
      }
    }
  }

  emit(event: string, ...args: unknown[]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const { fn, ctx } of set) {
      fn.apply(ctx, args);
    }
  }

  // React → Phaser
  emitSimEvent(event: SimEvent) {
    this.emit("sim:event", event);
  }

  emitPhaseChange(phase: number, month: number) {
    this.emit("sim:phase-change", { phase, month });
  }

  // React → Phaser
  emitCameraPan(dx: number, dy: number) {
    this.emit("sim:camera-pan", { dx, dy });
  }

  // React → Phaser: zoom camera
  emitCameraZoom(delta: number) {
    this.emit("sim:camera-zoom", { delta });
  }

  // React → Phaser: initialize NPCs from backend
  emitInitNPCs(npcs: unknown[]) {
    this.emit("sim:init-npcs", npcs);
  }

  // React → Phaser: move an NPC to new position
  emitNPCMove(npcId: string, toX: number, toY: number) {
    this.emit("sim:npc-move", { npcId, toX, toY });
  }

  // React → Phaser: update NPC mood
  emitNPCMood(npcId: string, mood: string) {
    this.emit("sim:npc-mood", { npcId, mood });
  }

  // Phaser → React
  emitNPCPosition(npc: NPCState) {
    this.emit("sim:npc-position", npc);
  }

  emitNPCHover(info: NPCHoverInfo) {
    this.emit("sim:npc-hover", info);
  }

  emitNPCHoverOut() {
    this.emit("sim:npc-hover-out");
  }
}

export const eventBridge = EventBridge.getInstance();
