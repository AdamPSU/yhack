import Phaser from "phaser";
import type { NPCState, SimEvent } from "@/lib/types";

/**
 * Singleton event bus bridging React ↔ Phaser.
 *
 * React side emits:
 *   sim:event        (SimEvent)       → Phaser receives and triggers game effects
 *   sim:phase-change ({phase, month}) → Phaser updates world state
 *
 * Phaser side emits:
 *   sim:npc-position (NPCState)       → React renders DOM chat bubbles
 */
class EventBridge extends Phaser.Events.EventEmitter {
  private static instance: EventBridge;

  private constructor() {
    super();
  }

  static getInstance(): EventBridge {
    if (!EventBridge.instance) {
      EventBridge.instance = new EventBridge();
    }
    return EventBridge.instance;
  }

  // React → Phaser
  emitSimEvent(event: SimEvent) {
    this.emit("sim:event", event);
  }

  emitPhaseChange(phase: number, month: number) {
    this.emit("sim:phase-change", { phase, month });
  }

  // Phaser → React
  emitNPCPosition(npc: NPCState) {
    this.emit("sim:npc-position", npc);
  }
}

export const eventBridge = EventBridge.getInstance();
