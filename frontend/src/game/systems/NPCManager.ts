import type * as Phaser from "phaser";
import { COORD_SCALE, moodToSentiment } from "@/lib/adapter";
import type { BackendNPC } from "@/lib/backendTypes";
import type { BuildingPositions } from "@/lib/types";
import { eventBridge } from "../bridge/EventBridge";
import { NPC } from "../entities/NPC";
import { MovementSystem } from "./MovementSystem";

function roleToZone(role: string): string {
  switch (role) {
    case "politician":
    case "activist":
      return "government";
    case "shopkeeper":
    case "business_owner":
      return "commercial";
    case "worker":
    case "farmer":
      return "industrial";
    default:
      return "residential";
  }
}

export class NPCManager {
  private scene: Phaser.Scene;
  private npcs: Map<string, NPC> = new Map();
  private movement: MovementSystem;
  private buildingPositions: BuildingPositions;
  private isWalkable: (col: number, row: number) => boolean;
  private groundGrid: number[][];
  /** Track assigned zone per NPC for releaseNPC */
  private npcZones: Map<string, string> = new Map();

  constructor(
    scene: Phaser.Scene,
    buildingPositions: BuildingPositions,
    isWalkable: (col: number, row: number) => boolean,
    groundGrid: number[][],
  ) {
    this.scene = scene;
    this.buildingPositions = buildingPositions;
    this.isWalkable = isWalkable;
    this.groundGrid = groundGrid;
    this.movement = new MovementSystem(scene, isWalkable, groundGrid);

    // Listen for dynamic NPC init from backend via EventBridge
    eventBridge.on("sim:init-npcs", this.onInitNPCs, this);
    eventBridge.on("sim:npc-move", this.onNPCMove, this);
    eventBridge.on("sim:npc-mood", this.onNPCMood, this);
  }

  private onInitNPCs(backendNPCs: unknown[]) {
    // Clear any existing NPCs (sprites + movement timers)
    this.movement.destroy();
    for (const npc of this.npcs.values()) {
      npc.destroy();
    }
    this.npcs.clear();
    this.npcZones.clear();

    // Re-create movement system (timers were destroyed)
    this.movement = new MovementSystem(
      this.scene,
      this.isWalkable,
      this.groundGrid,
    );

    const npcs = backendNPCs as BackendNPC[];

    for (let i = 0; i < npcs.length; i++) {
      const bn = npcs[i];

      let tileX = bn.x * COORD_SCALE;
      let tileY = bn.y * COORD_SCALE;

      // Snap to nearest walkable tile if landed on a building
      if (!this.isWalkable(tileX, tileY)) {
        const snapped = this.findNearestWalkable(tileX, tileY);
        if (snapped) {
          tileX = snapped.x;
          tileY = snapped.y;
        }
      }

      const charIndex = i % 16;
      const npc = new NPC(this.scene, bn.id, bn.name, charIndex, tileX, tileY);
      npc.role = bn.role;
      npc.sentiment = moodToSentiment(bn.mood);
      this.npcs.set(bn.id, npc);

      const zone = roleToZone(bn.role);
      this.npcZones.set(bn.id, zone);
      this.movement.startRoaming(npc, zone);
    }
  }

  private onNPCMove(data: { npcId: string; toX: number; toY: number }) {
    const npc = this.npcs.get(data.npcId);
    if (!npc) return;
    const targetX = data.toX * COORD_SCALE;
    const targetY = data.toY * COORD_SCALE;
    this.stepToward(npc, targetX, targetY, 5);
  }

  private onNPCMood(data: { npcId: string; mood: string }) {
    const npc = this.npcs.get(data.npcId);
    if (!npc) return;
    npc.sentiment = moodToSentiment(data.mood);
  }

  private findNearestWalkable(
    x: number,
    y: number,
  ): { x: number; y: number } | null {
    for (let r = 1; r <= 5; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (this.isWalkable(x + dx, y + dy)) {
            return { x: x + dx, y: y + dy };
          }
        }
      }
    }
    return null;
  }

  getNPC(id: string): NPC | undefined {
    return this.npcs.get(id);
  }

  getAllNPCs(): NPC[] {
    return [...this.npcs.values()];
  }

  /** Override movement: NPC stops roaming and enters protest/override state at current position */
  sendTo(npcId: string, _targetCol: number, _targetRow: number) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    this.movement.override(npcId);
    npc.npcState = "protesting";
    // NPC stays at current position — no teleporting across the map
  }

  /** Release an NPC back to normal roaming in their assigned zone */
  releaseNPC(npcId: string) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;
    npc.npcState = "idle";
    this.movement.release(npcId);
    this.movement.startRoaming(npc, this.npcZones.get(npcId));
  }

  /** Show chat bubble via EventBridge → React */
  showMessage(npcId: string, message: string) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    npc.message = message;
    eventBridge.emitNPCPosition(npc.toState());

    // Continuously emit position updates while message is active so React bubble follows NPC
    const posTimer = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        if (!npc.message) {
          posTimer.destroy();
          eventBridge.emitNPCPosition(npc.toState());
          return;
        }
        eventBridge.emitNPCPosition(npc.toState());
      },
      loop: true,
    });

    // Clear message after display time
    this.scene.time.delayedCall(5000, () => {
      npc.message = undefined;
    });
  }

  /** Walk npcA toward npcB, pause for conversation, then release both */
  converseWith(npcIdA: string, npcIdB: string) {
    const npcA = this.npcs.get(npcIdA);
    const npcB = this.npcs.get(npcIdB);
    if (!npcA || !npcB) return;

    // Override both so they stop roaming
    this.movement.override(npcIdA);
    this.movement.override(npcIdB);

    // Step-walk npcA toward npcB (max 5 steps to avoid long paths)
    this.stepToward(npcA, npcB.tileX, npcB.tileY, 5).then(() => {
      // Face each other
      if (npcA.tileX < npcB.tileX) {
        npcA.face("right");
        npcB.face("left");
      } else if (npcA.tileX > npcB.tileX) {
        npcA.face("left");
        npcB.face("right");
      } else if (npcA.tileY < npcB.tileY) {
        npcA.face("down");
        npcB.face("up");
      } else {
        npcA.face("up");
        npcB.face("down");
      }

      // Release both after chat bubble fades (6s — slightly after 5s message timeout)
      this.scene.time.delayedCall(6000, () => {
        this.releaseNPC(npcIdA);
        this.releaseNPC(npcIdB);
      });
    });
  }

  /** Walk an NPC step-by-step toward a target, up to maxSteps moves */
  private async stepToward(
    npc: NPC,
    targetX: number,
    targetY: number,
    maxSteps: number,
  ) {
    for (let i = 0; i < maxSteps; i++) {
      const dx = targetX - npc.tileX;
      const dy = targetY - npc.tileY;

      // Close enough (adjacent or same tile)
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) break;

      // Pick the best adjacent step toward target
      const candidates: { col: number; row: number; dist: number }[] = [];
      for (const [cx, cy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        const nx = npc.tileX + cx;
        const ny = npc.tileY + cy;
        if (!this.isWalkable(nx, ny)) continue;
        const dist = Math.abs(targetX - nx) + Math.abs(targetY - ny);
        candidates.push({ col: nx, row: ny, dist });
      }

      if (candidates.length === 0) break;

      // Pick closest to target
      candidates.sort((a, b) => a.dist - b.dist);
      await npc.walkTo(candidates[0].col, candidates[0].row);
    }
  }

  /** Get building positions for effects */
  getBuildings(): BuildingPositions {
    return this.buildingPositions;
  }

  destroy() {
    eventBridge.off("sim:init-npcs", this.onInitNPCs, this);
    eventBridge.off("sim:npc-move", this.onNPCMove, this);
    eventBridge.off("sim:npc-mood", this.onNPCMood, this);
    this.movement.destroy();
    for (const npc of this.npcs.values()) {
      npc.destroy();
    }
    this.npcs.clear();
    this.npcZones.clear();
  }
}
