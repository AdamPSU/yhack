import { CENTER_BOUNDS, MAP_COLS, MAP_ROWS } from "../config";
import type { NPC } from "../entities/NPC";
import * as Tiles from "../map/TileRegistry";
import type { OccupancyGrid } from "./OccupancyGrid";

type WalkableCheck = (col: number, row: number) => boolean;

/** Cardinal direction deltas */
const DIRS = [
  { dx: 0, dy: -1 }, // up
  { dx: 0, dy: 1 }, // down
  { dx: -1, dy: 0 }, // left
  { dx: 1, dy: 0 }, // right
] as const;

/** Opposite direction index: up↔down, left↔right */
const OPPOSITE = [1, 0, 3, 2] as const;

/** Tile indices that count as road or sidewalk — NPCs should stay on these */
const ROAD_TILES = new Set([
  Tiles.ROAD_H,
  Tiles.ROAD_V,
  Tiles.ROAD_CROSS,
  Tiles.SIDEWALK,
  Tiles.CONCRETE,
  Tiles.CONCRETE_ALT,
]);

interface ZoneBounds {
  minRow: number;
  maxRow: number;
}

const ZONE_BOUNDS: Record<string, ZoneBounds> = {
  government: { minRow: 3, maxRow: 10 },
  commercial: { minRow: 11, maxRow: 16 },
  industrial: { minRow: 19, maxRow: 24 },
  residential: { minRow: 0, maxRow: 29 },
};

/**
 * Handles NPC roaming with natural movement behavior.
 * - NPCs prefer roads and sidewalks over grass
 * - NPCs maintain momentum (avoid instant 180-degree turns)
 * - NPCs are leashed to their assigned zone
 * - Walk→pause→walk cycle with variable timing
 */
export class MovementSystem {
  private timers: Map<string, Phaser.Time.TimerEvent> = new Map();
  private scene: Phaser.Scene;
  private isWalkable: WalkableCheck;
  private groundGrid: number[][];
  /** Offsets for ground grid indexing (grid[row - gridRowOffset][col - gridColOffset]) */
  private gridRowOffset: number;
  private gridColOffset: number;
  /** Last movement direction index per NPC (0=up,1=down,2=left,3=right) */
  private lastDir: Map<string, number> = new Map();
  /** Assigned zone per NPC */
  private npcZone: Map<string, string> = new Map();
  /** NPCs currently overridden (protesting/striking) — skip random movement */
  private overridden = new Set<string>();
  private occupancy: OccupancyGrid;

  constructor(
    scene: Phaser.Scene,
    isWalkable: WalkableCheck,
    groundGrid: number[][],
    occupancy: OccupancyGrid,
    gridRowOffset = 0,
    gridColOffset = 0,
  ) {
    this.scene = scene;
    this.isWalkable = isWalkable;
    this.groundGrid = groundGrid;
    this.occupancy = occupancy;
    this.gridRowOffset = gridRowOffset;
    this.gridColOffset = gridColOffset;
  }

  /** Start random roaming for an NPC */
  startRoaming(npc: NPC, zone?: string) {
    if (zone) {
      this.npcZone.set(npc.npcId, zone);
    }
    // Stagger initial delay so NPCs don't all move at once
    const delay = 1500 + Math.random() * 3000;
    const timer = this.scene.time.addEvent({
      delay,
      callback: () => this.step(npc),
      loop: false,
    });
    this.timers.set(npc.npcId, timer);
  }

  /** Pause random movement for an NPC (e.g. while protesting) */
  override(npcId: string) {
    this.overridden.add(npcId);
    const timer = this.timers.get(npcId);
    if (timer) timer.destroy();
    this.timers.delete(npcId);
  }

  /** Resume random movement */
  release(npcId: string) {
    this.overridden.delete(npcId);
  }

  private isRoadTile(col: number, row: number): boolean {
    const gr = row - this.gridRowOffset;
    const gc = col - this.gridColOffset;
    if (gr < 0 || gr >= this.groundGrid.length) return false;
    if (gc < 0 || gc >= (this.groundGrid[0]?.length ?? 0)) return false;
    return ROAD_TILES.has(this.groundGrid[gr][gc]);
  }

  private step(npc: NPC) {
    if (this.overridden.has(npc.npcId)) return;
    if (npc.isMoving) {
      this.scheduleNext(npc, 200);
      return;
    }

    // 30% chance to idle (look around), 70% chance to walk
    if (Math.random() < 0.3) {
      // Idle: face a random direction without moving
      const dirs = ["up", "down", "left", "right"] as const;
      npc.face(dirs[Math.floor(Math.random() * dirs.length)]);
      npc.npcState = "idle";
      // Longer pause when idling
      this.scheduleNext(npc, 1500 + Math.random() * 2500);
      return;
    }

    const chosen = this.pickDirection(npc);
    if (chosen === null) {
      // Stuck — idle and try again soon
      npc.npcState = "idle";
      this.scheduleNext(npc, 500);
      return;
    }

    const dir = DIRS[chosen];
    this.lastDir.set(npc.npcId, chosen);
    npc.npcState = "walking";
    this.occupancy.occupy(npc.npcId, npc.tileX + dir.dx, npc.tileY + dir.dy);
    npc.walkTo(npc.tileX + dir.dx, npc.tileY + dir.dy).then(() => {
      npc.npcState = "idle";
      // Brief pause after each step
      this.scheduleNext(npc, 400 + Math.random() * 800);
    });
  }

  private pickDirection(npc: NPC): number | null {
    const lastDirIdx = this.lastDir.get(npc.npcId);
    const zone = this.npcZone.get(npc.npcId);
    const bounds = zone ? ZONE_BOUNDS[zone] : undefined;

    // Score each direction
    const scored: { idx: number; score: number }[] = [];

    for (let i = 0; i < DIRS.length; i++) {
      const { dx, dy } = DIRS[i];
      const nx = npc.tileX + dx;
      const ny = npc.tileY + dy;

      if (!this.isWalkable(nx, ny)) continue;
      if (this.occupancy.isOccupiedByOther(npc.npcId, nx, ny)) continue;

      // Reject tiles outside center bounds
      if (
        nx < CENTER_BOUNDS.minCol ||
        nx > CENTER_BOUNDS.maxCol ||
        ny < CENTER_BOUNDS.minRow ||
        ny > CENTER_BOUNDS.maxRow
      )
        continue;

      let score = 1;

      // Strongly prefer road/sidewalk tiles
      if (this.isRoadTile(nx, ny)) {
        score += 10;
      } else {
        // Grass/other — heavily penalize but allow as last resort
        score = 0.1;
      }

      // Momentum: prefer continuing in the same direction
      if (lastDirIdx !== undefined && i === lastDirIdx) {
        score *= 2;
      }

      // Penalize instant 180-degree turns
      if (lastDirIdx !== undefined && i === OPPOSITE[lastDirIdx]) {
        score *= 0.15;
      }

      // Zone leashing: penalize moves that go away from home zone
      if (bounds) {
        const zoneCenterRow = (bounds.minRow + bounds.maxRow) / 2;
        const currentDist = Math.abs(npc.tileY - zoneCenterRow);
        const nextDist = Math.abs(ny - zoneCenterRow);

        // If already outside zone, strongly pull back
        if (npc.tileY < bounds.minRow || npc.tileY > bounds.maxRow) {
          if (nextDist < currentDist) score *= 4;
          else score *= 0.1;
        }
        // If near zone boundary, mild bias inward
        else if (
          npc.tileY <= bounds.minRow + 1 ||
          npc.tileY >= bounds.maxRow - 1
        ) {
          if (nextDist < currentDist) score *= 1.5;
          else if (nextDist > currentDist) score *= 0.5;
        }
      }

      scored.push({ idx: i, score });
    }

    if (scored.length === 0) return null;

    // Weighted random selection
    const totalWeight = scored.reduce((sum, s) => sum + s.score, 0);
    let roll = Math.random() * totalWeight;
    for (const s of scored) {
      roll -= s.score;
      if (roll <= 0) return s.idx;
    }
    return scored[scored.length - 1].idx;
  }

  private scheduleNext(npc: NPC, delay: number) {
    if (this.overridden.has(npc.npcId)) return;
    const timer = this.scene.time.addEvent({
      delay,
      callback: () => this.step(npc),
      loop: false,
    });
    this.timers.set(npc.npcId, timer);
  }

  destroy() {
    for (const timer of this.timers.values()) {
      timer.destroy();
    }
    this.timers.clear();
    this.overridden.clear();
    this.lastDir.clear();
    this.npcZone.clear();
  }
}
