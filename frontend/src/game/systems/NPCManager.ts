import type * as Phaser from "phaser";
import { getCoordScale, moodToSentiment } from "@/lib/adapter";
import type { BuildingPositions } from "@/types";
import type { BackendNPC } from "@/types/backend";
import { eventBridge } from "../bridge/EventBridge";
import { CENTER_BOUNDS, TILE_SIZE } from "../config";
import { Car } from "../entities/Car";
import { NPC } from "../entities/NPC";
import { CAR_TEMPLATES, type CarTemplate } from "../map/CarRegistry";
import { roleToCharacter } from "../map/NPCCharacterRegistry";
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

const MIN_SPAWN_SPACING = 4;

export class NPCManager {
  private scene: Phaser.Scene;
  private npcs: Map<string, NPC> = new Map();
  private movement: MovementSystem;
  private buildingPositions: BuildingPositions;
  private isWalkable: (col: number, row: number) => boolean;
  private isRoad: (col: number, row: number) => boolean;
  private getRoadType: (col: number, row: number) => "v" | "h" | "none";
  private occupancy: OccupancyGrid;
  /** Track assigned zone per NPC for releaseNPC */
  private npcZones: Map<string, string> = new Map();
  /** Track active position-update timers per NPC to avoid duplicates */
  private positionTimers: Map<string, Phaser.Time.TimerEvent> = new Map();
  /** Track active message-expiry timers per NPC so newer chats replace older ones cleanly. */
  private messageTimers: Map<string, Phaser.Time.TimerEvent> = new Map();
  /** Track delayed conversation-release timers per NPC to avoid stale releases. */
  private conversationTimers: Map<string, Phaser.Time.TimerEvent> = new Map();
  /** Monotonic version per NPC used to invalidate stale conversation callbacks. */
  private conversationVersions: Map<string, number> = new Map();

  constructor(
    scene: Phaser.Scene,
    buildingPositions: BuildingPositions,
    isWalkable: (col: number, row: number) => boolean,
    isRoad: (col: number, row: number) => boolean,
    getRoadType: (col: number, row: number) => "v" | "h" | "none" = () =>
      "none",
  ) {
    this.scene = scene;
    this.buildingPositions = buildingPositions;
    this.isWalkable = isWalkable;
    this.isRoad = isRoad;
    this.getRoadType = getRoadType;
    this.occupancy = new OccupancyGrid();
    this.movement = new MovementSystem(
      scene,
      isWalkable,
      isRoad,
      this.occupancy,
    );

    // Listen for dynamic NPC init from backend via EventBridge
    eventBridge.on("sim:init-npcs", this.onInitNPCs, this);
    eventBridge.on("sim:npc-move", this.onNPCMove, this);
    eventBridge.on("sim:npc-mood", this.onNPCMood, this);
  }

  private onInitNPCs(backendNPCs: unknown[]) {
    // Clear any existing NPCs (sprites + movement timers)
    this.movement.destroy();
    for (const timer of this.positionTimers.values()) timer.destroy();
    this.positionTimers.clear();
    for (const timer of this.messageTimers.values()) timer.destroy();
    this.messageTimers.clear();
    for (const timer of this.conversationTimers.values()) timer.destroy();
    this.conversationTimers.clear();
    this.conversationVersions.clear();
    for (const npc of this.npcs.values()) {
      npc.message = undefined;
      this.emitNPCPosition(npc);
      npc.destroy();
    }
    this.npcs.clear();
    this.npcZones.clear();
    this.occupancy.clear();

    // Re-create movement system (timers were destroyed)
    this.movement = new MovementSystem(
      this.scene,
      this.isWalkable,
      this.isRoad,
      this.occupancy,
    );

    const npcs = backendNPCs as BackendNPC[];

    // Collect all road+walkable tiles for spread-out spawning
    const roadTiles: { x: number; y: number }[] = [];
    for (let row = CENTER_BOUNDS.minRow; row <= CENTER_BOUNDS.maxRow; row++) {
      for (let col = CENTER_BOUNDS.minCol; col <= CENTER_BOUNDS.maxCol; col++) {
        if (this.isRoad(col, row) && this.isWalkable(col, row)) {
          roadTiles.push({ x: col, y: row });
        }
      }
    }

    // Shuffle for random distribution
    for (let i = roadTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roadTiles[i], roadTiles[j]] = [roadTiles[j], roadTiles[i]];
    }

    const canFitCar = (
      col: number,
      row: number,
      template: CarTemplate,
    ): boolean => {
      if (template.orientation === "portrait") {
        // 2 wide × 3 tall — check left and right column of vertical road pair
        return (
          this.getRoadType(col, row) === "v" &&
          this.getRoadType(col + 1, row) === "v" &&
          this.isWalkable(col, row) &&
          this.isWalkable(col + 1, row) &&
          !this.occupancy.isOccupied(col, row) &&
          !this.occupancy.isOccupied(col + 1, row)
        );
      }
      // 3 wide × 2 tall — ALL 6 tiles must be horizontal road and walkable
      for (let dc = 0; dc < template.cols; dc++) {
        for (let dr = 0; dr < template.rows; dr++) {
          if (this.getRoadType(col + dc, row + dr) !== "h") return false;
          if (!this.isWalkable(col + dc, row + dr)) return false;
          if (this.occupancy.isOccupied(col + dc, row + dr)) return false;
        }
      }
      return true;
    };

    for (let i = 0; i < npcs.length; i++) {
      const bn = npcs[i];

      if (bn.role === "driver") {
        // Spawn a Car entity aligned to its road pair
        const template = CAR_TEMPLATES[i % CAR_TEMPLATES.length];

        let tileX = -1;
        let tileY = -1;
        for (const candidate of roadTiles) {
          if (this.occupancy.isOccupied(candidate.x, candidate.y)) continue;
          if (canFitCar(candidate.x, candidate.y, template)) {
            tileX = candidate.x;
            tileY = candidate.y;
            break;
          }
        }

        // Last resort: use backend coords + snap to nearest road
        if (tileX === -1) {
          tileX = Math.max(
            CENTER_BOUNDS.minCol,
            Math.min(CENTER_BOUNDS.maxCol, bn.x * getCoordScale()),
          );
          tileY = Math.max(
            CENTER_BOUNDS.minRow,
            Math.min(CENTER_BOUNDS.maxRow, bn.y * getCoordScale()),
          );
          const snapped = this.findNearestTile(
            tileX,
            tileY,
            (c, r) => this.isRoad(c, r) && this.isWalkable(c, r),
            10,
          );
          if (snapped) {
            tileX = snapped.x;
            tileY = snapped.y;
          }
        }

        if (tileX === -1) continue; // skip if no valid spawn found

        const car = new Car(this.scene, bn.id, bn.name, template, tileX, tileY);
        car.role = bn.role;
        car.sentiment = moodToSentiment(bn.mood);
        this.npcs.set(bn.id, car as unknown as NPC);

        // Mark all tiles of the car footprint as occupied
        for (let dc = 0; dc < template.cols; dc++) {
          for (let dr = 0; dr < template.rows; dr++) {
            this.occupancy.occupy(
              `${bn.id}_${dc}_${dr}`,
              tileX + dc,
              tileY + dr,
            );
          }
        }

        const zone = roleToZone(bn.role);
        this.npcZones.set(bn.id, zone);
        this.movement.startRoaming(car as unknown as NPC, zone);
      } else {
        // Find a road tile with adequate spacing from other NPCs
        let tileX = -1;
        let tileY = -1;

        // Try with spacing constraint first
        for (const candidate of roadTiles) {
          if (this.occupancy.isOccupied(candidate.x, candidate.y)) continue;
          if (this.hasMinSpacing(candidate.x, candidate.y, MIN_SPAWN_SPACING)) {
            tileX = candidate.x;
            tileY = candidate.y;
            break;
          }
        }

        // Fallback: relax spacing, just find any unoccupied road tile
        if (tileX === -1) {
          for (const candidate of roadTiles) {
            if (!this.occupancy.isOccupied(candidate.x, candidate.y)) {
              tileX = candidate.x;
              tileY = candidate.y;
              break;
            }
          }
        }

        // Last resort: use backend coords + snap to nearest road
        if (tileX === -1) {
          tileX = Math.max(
            CENTER_BOUNDS.minCol,
            Math.min(CENTER_BOUNDS.maxCol, bn.x * getCoordScale()),
          );
          tileY = Math.max(
            CENTER_BOUNDS.minRow,
            Math.min(CENTER_BOUNDS.maxRow, bn.y * getCoordScale()),
          );
          const snapped = this.findNearestTile(
            tileX,
            tileY,
            (c, r) => this.isRoad(c, r) && this.isWalkable(c, r),
            10,
          );
          if (snapped) {
            tileX = snapped.x;
            tileY = snapped.y;
          }
        }

        const charType = roleToCharacter(bn.role, i);
        const npc = new NPC(
          this.scene,
          bn.id,
          bn.name,
          charType,
          tileX,
          tileY,
        );
        npc.role = bn.role;
        npc.category = bn.category ?? "";
        npc.sentiment = moodToSentiment(bn.mood);
        this.npcs.set(bn.id, npc);
        this.occupancy.occupy(bn.id, tileX, tileY);

        const zone = roleToZone(bn.role);
        this.npcZones.set(bn.id, zone);
        this.movement.startRoaming(npc, zone);
      }
    }

    // Center camera on NPC cluster
    this.centerCameraOnNPCs();
  }

  /** Check if position has minimum Manhattan distance from all placed NPCs */
  private hasMinSpacing(x: number, y: number, minDist: number): boolean {
    for (const npc of this.npcs.values()) {
      if (Math.abs(npc.tileX - x) + Math.abs(npc.tileY - y) < minDist) {
        return false;
      }
    }
    return true;
  }

  /** Search outward in rings for a tile matching `predicate` */
  private findNearestTile(
    x: number,
    y: number,
    predicate: (col: number, row: number) => boolean,
    maxRadius = 5,
  ): { x: number; y: number } | null {
    for (let r = 0; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const nx = x + dx;
          const ny = y + dy;
          if (predicate(nx, ny) && !this.occupancy.isOccupied(nx, ny)) {
            return { x: nx, y: ny };
          }
        }
      }
    }
    return null;
  }

  /** Center camera on the centroid of all spawned NPCs */
  private centerCameraOnNPCs() {
    if (this.npcs.size === 0) return;
    let sumX = 0;
    let sumY = 0;
    for (const npc of this.npcs.values()) {
      sumX += npc.tileX;
      sumY += npc.tileY;
    }
    const centroidX = (sumX / this.npcs.size) * TILE_SIZE + TILE_SIZE / 2;
    const centroidY = (sumY / this.npcs.size) * TILE_SIZE + TILE_SIZE / 2;

    const cam = this.scene.cameras.main;
    cam.centerOn(centroidX, centroidY);
    cam.setZoom(1.5);
  }

  private emitNPCPosition(npc: NPC) {
    const state = npc.toState();
    if (!state) return;
    eventBridge.emitNPCPosition(state);
  }

  private clearConversationTimer(npcId: string) {
    this.conversationTimers.get(npcId)?.destroy();
    this.conversationTimers.delete(npcId);
  }

  private bumpConversationVersion(npcId: string): number {
    const next = (this.conversationVersions.get(npcId) ?? 0) + 1;
    this.conversationVersions.set(npcId, next);
    return next;
  }

  private onNPCMove(data: { npcId: string; toX: number; toY: number }) {
    const npc = this.npcs.get(data.npcId);
    if (!npc) return;
    const targetX = data.toX * getCoordScale();
    const targetY = data.toY * getCoordScale();
    this.stepToward(npc, targetX, targetY, 5);
  }

  private onNPCMood(data: { npcId: string; mood: string }) {
    const npc = this.npcs.get(data.npcId);
    if (!npc) return;
    npc.sentiment = moodToSentiment(data.mood);
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
    this.clearConversationTimer(npcId);
    this.bumpConversationVersion(npcId);
    npc.npcState = "idle";
    this.movement.release(npcId);
    this.movement.startRoaming(npc, this.npcZones.get(npcId));
  }

  /** Show chat bubble via EventBridge → React */
  showMessage(npcId: string, message: string) {
    const npc = this.npcs.get(npcId);
    if (!npc) return;

    npc.message = message;
    this.emitNPCPosition(npc);

    // Cancel existing position timer for this NPC if any
    this.positionTimers.get(npcId)?.destroy();
    this.positionTimers.delete(npcId);
    // Cancel any prior expiry timer so a newer message cannot be cleared by an older one.
    this.messageTimers.get(npcId)?.destroy();
    this.messageTimers.delete(npcId);

    // Continuously emit position updates while message is active so React bubble follows NPC
    const posTimer = this.scene.time.addEvent({
      delay: 16,
      callback: () => {
        if (!npc.message) {
          posTimer.destroy();
          this.positionTimers.delete(npcId);
          this.emitNPCPosition(npc);
          return;
        }
        this.emitNPCPosition(npc);
      },
      loop: true,
    });
    this.positionTimers.set(npcId, posTimer);

    // Clear message after display time
    const messageTimer = this.scene.time.delayedCall(5000, () => {
      npc.message = undefined;
      this.messageTimers.delete(npcId);
    });
    this.messageTimers.set(npcId, messageTimer);
  }

  /** Walk npcA toward npcB, pause for conversation, then release both */
  converseWith(npcIdA: string, npcIdB: string) {
    const npcA = this.npcs.get(npcIdA);
    const npcB = this.npcs.get(npcIdB);
    if (!npcA || !npcB) return;

    const versionA = this.bumpConversationVersion(npcIdA);
    const versionB = this.bumpConversationVersion(npcIdB);
    this.clearConversationTimer(npcIdA);
    this.clearConversationTimer(npcIdB);

    // Override both so they stop roaming
    this.movement.override(npcIdA);
    this.movement.override(npcIdB);

    // Drivers stay in their lane — skip walk-toward to avoid leaving road tiles
    const eitherIsDriver = npcA.role === "driver" || npcB.role === "driver";
    const walkPromise = eitherIsDriver
      ? Promise.resolve()
      : (() => {
          const adj = this.findAdjacentWalkable(
            npcB.tileX,
            npcB.tileY,
            npcA.npcId,
          );
          const goalX = adj ? adj.x : npcB.tileX;
          const goalY = adj ? adj.y : npcB.tileY;
          return this.stepToward(npcA, goalX, goalY, 5);
        })();

    walkPromise.then(() => {
      if (
        this.conversationVersions.get(npcIdA) !== versionA ||
        this.conversationVersions.get(npcIdB) !== versionB
      ) {
        return;
      }

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
      const scheduleRelease = (npcId: string, version: number) => {
        const timer = this.scene.time.delayedCall(6000, () => {
          if (
            this.conversationVersions.get(npcId) !== version ||
            this.conversationTimers.get(npcId) !== timer
          ) {
            return;
          }
          this.conversationTimers.delete(npcId);
          this.releaseNPC(npcId);
        });
        this.conversationTimers.set(npcId, timer);
      };

      scheduleRelease(npcIdA, versionA);
      scheduleRelease(npcIdB, versionB);
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
      const snapped = this.findNearestTile(goalX, goalY, (c, r) =>
        this.isWalkable(c, r),
      );
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
    for (const t of this.positionTimers.values()) t.destroy();
    this.positionTimers.clear();
    for (const t of this.messageTimers.values()) t.destroy();
    this.messageTimers.clear();
    for (const t of this.conversationTimers.values()) t.destroy();
    this.conversationTimers.clear();
    this.conversationVersions.clear();
    this.movement.destroy();
    for (const npc of this.npcs.values()) {
      npc.destroy();
    }
    this.npcs.clear();
    this.npcZones.clear();
    this.occupancy.clear();
  }
}
