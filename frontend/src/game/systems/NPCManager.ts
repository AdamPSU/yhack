import type * as Phaser from "phaser";
import { COORD_SCALE, moodToSentiment } from "@/lib/adapter";
import type { BuildingPositions } from "@/types";
import type { BackendNPC } from "@/types/backend";
import { eventBridge } from "../bridge/EventBridge";
import { CENTER_BOUNDS } from "../config";
import { NPC } from "../entities/NPC";
import { MovementSystem } from "./MovementSystem";
import { OccupancyGrid } from "./OccupancyGrid";
import { findPath } from "./Pathfinder";

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
  private gridRowOffset: number;
  private gridColOffset: number;
  private occupancy: OccupancyGrid;
  /** Track assigned zone per NPC for releaseNPC */
  private npcZones: Map<string, string> = new Map();

  constructor(
    scene: Phaser.Scene,
    buildingPositions: BuildingPositions,
    isWalkable: (col: number, row: number) => boolean,
    groundGrid: number[][],
    gridRowOffset = 0,
    gridColOffset = 0,
  ) {
    this.scene = scene;
    this.buildingPositions = buildingPositions;
    this.isWalkable = isWalkable;
    this.groundGrid = groundGrid;
    this.gridRowOffset = gridRowOffset;
    this.gridColOffset = gridColOffset;
    this.occupancy = new OccupancyGrid();
    this.movement = new MovementSystem(
      scene,
      isWalkable,
      groundGrid,
      this.occupancy,
      gridRowOffset,
      gridColOffset,
    );

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
    this.occupancy.clear();

    // Re-create movement system (timers were destroyed)
    this.movement = new MovementSystem(
      this.scene,
      this.isWalkable,
      this.groundGrid,
      this.occupancy,
      this.gridRowOffset,
      this.gridColOffset,
    );

    const npcs = backendNPCs as BackendNPC[];

    for (let i = 0; i < npcs.length; i++) {
      const bn = npcs[i];

      let tileX = bn.x * COORD_SCALE;
      let tileY = bn.y * COORD_SCALE;

      // Clamp to center bounds so NPCs stay in the demo-visible area
      tileX = Math.max(
        CENTER_BOUNDS.minCol,
        Math.min(CENTER_BOUNDS.maxCol, tileX),
      );
      tileY = Math.max(
        CENTER_BOUNDS.minRow,
        Math.min(CENTER_BOUNDS.maxRow, tileY),
      );

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
      this.occupancy.occupy(bn.id, tileX, tileY);

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
          const nx = x + dx;
          const ny = y + dy;
          if (this.isWalkable(nx, ny) && !this.occupancy.isOccupied(nx, ny)) {
            return { x: nx, y: ny };
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

    // Find a walkable tile adjacent to npcB (not B's tile itself)
    const adj = this.findAdjacentWalkable(npcB.tileX, npcB.tileY, npcA.npcId);
    const goalX = adj ? adj.x : npcB.tileX;
    const goalY = adj ? adj.y : npcB.tileY;

    // Step-walk npcA toward npcB (max 5 steps to avoid long paths)
    this.stepToward(npcA, goalX, goalY, 5).then(() => {
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

  /** Walk an NPC step-by-step toward a target using A* pathfinding */
  private async stepToward(
    npc: NPC,
    targetX: number,
    targetY: number,
    maxSteps: number,
  ) {
    // Snap goal to walkable tile if it's inside a building
    let goalX = targetX;
    let goalY = targetY;
    if (!this.isWalkable(goalX, goalY)) {
      const snapped = this.findNearestWalkable(goalX, goalY);
      if (!snapped) return;
      goalX = snapped.x;
      goalY = snapped.y;
    }

    const path = findPath(
      { col: npc.tileX, row: npc.tileY },
      { col: goalX, row: goalY },
      this.isWalkable,
    );
    if (!path || path.length === 0) return;

    for (let i = 0; i < Math.min(maxSteps, path.length); i++) {
      const next = path[i];
      // Re-check occupancy at step time — another NPC may have moved here
      if (this.occupancy.isOccupiedByOther(npc.npcId, next.col, next.row))
        break;
      this.occupancy.occupy(npc.npcId, next.col, next.row);
      await npc.walkTo(next.col, next.row);
    }
  }

  /** Find a walkable, unoccupied tile adjacent to (col, row) */
  private findAdjacentWalkable(
    col: number,
    row: number,
    forNpcId: string,
  ): { x: number; y: number } | null {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const nx = col + dx;
      const ny = row + dy;
      if (
        this.isWalkable(nx, ny) &&
        !this.occupancy.isOccupiedByOther(forNpcId, nx, ny)
      ) {
        return { x: nx, y: ny };
      }
    }
    return null;
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
    this.occupancy.clear();
  }
}
