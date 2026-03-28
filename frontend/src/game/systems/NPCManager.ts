import type * as Phaser from "phaser";
import type { BuildingPositions } from "@/lib/types";
import { eventBridge } from "../bridge/EventBridge";
import { NPC } from "../entities/NPC";
import { MovementSystem } from "./MovementSystem";

/** NPC roster: id → display name + character sprite index */
const NPC_ROSTER: { id: string; name: string; charIndex: number }[] = [
  { id: "gov_federal", name: "Director Chen", charIndex: 0 },
  { id: "gov_central_bank", name: "Chair Powell", charIndex: 1 },
  { id: "corp_manufacturing", name: "CEO Martinez", charIndex: 2 },
  { id: "corp_retail", name: "Jim's Auto", charIndex: 3 },
  { id: "sme_shop", name: "Aisha Patel", charIndex: 4 },
  { id: "media_outlet", name: "Reporter Davis", charIndex: 5 },
  { id: "labor_union", name: "Tony Russo", charIndex: 6 },
  { id: "hh_hnw_1", name: "James Park", charIndex: 7 },
  { id: "hh_mc_1", name: "Maria Santos", charIndex: 8 },
  { id: "hh_poor_1", name: "Frank Kowalski", charIndex: 9 },
];

/** Zone assignment — where each NPC prefers to spawn */
type Zone = "government" | "commercial" | "industrial" | "residential";

const ZONE_MAP: Record<string, Zone> = {
  gov_federal: "government",
  gov_central_bank: "government",
  corp_manufacturing: "industrial",
  corp_retail: "commercial",
  sme_shop: "commercial",
  media_outlet: "commercial",
  labor_union: "industrial",
  hh_hnw_1: "residential",
  hh_mc_1: "residential",
  hh_poor_1: "residential",
};

const ROLE_MAP: Record<string, string> = {
  gov_federal: "Federal Policy Director",
  gov_central_bank: "Central Bank Chair",
  corp_manufacturing: "Manufacturing CEO",
  corp_retail: "Auto Shop Owner",
  sme_shop: "Corner Store Owner",
  media_outlet: "News Reporter",
  labor_union: "Union Leader",
  hh_hnw_1: "Wealthy Investor",
  hh_mc_1: "Middle-Class Worker",
  hh_poor_1: "Low-Income Worker",
};

export class NPCManager {
  private scene: Phaser.Scene;
  private npcs: Map<string, NPC> = new Map();
  private movement: MovementSystem;
  private buildingPositions: BuildingPositions;
  private isWalkable: (col: number, row: number) => boolean;

  constructor(
    scene: Phaser.Scene,
    walkableTiles: { x: number; y: number }[],
    buildingPositions: BuildingPositions,
    isWalkable: (col: number, row: number) => boolean,
    groundGrid: number[][],
  ) {
    this.scene = scene;
    this.buildingPositions = buildingPositions;
    this.isWalkable = isWalkable;
    this.movement = new MovementSystem(scene, isWalkable, groundGrid);

    const walkableByZone = this.partitionByZone(walkableTiles);

    // Spawn each NPC on a road/sidewalk tile near their preferred zone
    for (const entry of NPC_ROSTER) {
      const zone = ZONE_MAP[entry.id] ?? "residential";
      const candidates = walkableByZone.get(zone) ?? walkableTiles;

      // Prefer spawning on road/sidewalk tiles
      const roadTiles = candidates.filter((t) =>
        this.isRoadOrSidewalk(groundGrid, t.x, t.y),
      );
      const pool = roadTiles.length > 0 ? roadTiles : candidates;
      const spawn = pool[Math.floor(Math.random() * pool.length)];

      if (!spawn) continue;

      const npc = new NPC(
        scene,
        entry.id,
        entry.name,
        entry.charIndex,
        spawn.x,
        spawn.y,
      );
      npc.role = ROLE_MAP[entry.id] ?? "Citizen";
      this.npcs.set(entry.id, npc);
      this.movement.startRoaming(npc, zone);
    }
  }

  private isRoadOrSidewalk(
    ground: number[][],
    col: number,
    row: number,
  ): boolean {
    const tile = ground[row]?.[col];
    // Road and sidewalk tile indices from TileRegistry
    return (
      tile === 355 || // ROAD_H
      tile === 358 || // ROAD_V
      tile === 94 || // ROAD_CROSS / intersections
      tile === 86 || // SIDEWALK / CONCRETE
      tile === 87 // CONCRETE_ALT
    );
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
    this.movement.startRoaming(npc, ZONE_MAP[npcId]);
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

  /** Partition walkable tiles into zones based on row ranges */
  private partitionByZone(
    tiles: { x: number; y: number }[],
  ): Map<Zone, { x: number; y: number }[]> {
    const zones = new Map<Zone, { x: number; y: number }[]>();
    zones.set("government", []);
    zones.set("commercial", []);
    zones.set("industrial", []);
    zones.set("residential", []);

    for (const tile of tiles) {
      // Zone by row: government 3-10, commercial 11-16, industrial 19-24, residential everywhere else
      if (tile.y >= 3 && tile.y <= 10) {
        zones.get("government")?.push(tile);
      } else if (tile.y >= 11 && tile.y <= 16) {
        zones.get("commercial")?.push(tile);
      } else if (tile.y >= 19 && tile.y <= 24) {
        zones.get("industrial")?.push(tile);
      } else {
        zones.get("residential")?.push(tile);
      }
    }

    return zones;
  }

  destroy() {
    this.movement.destroy();
    for (const npc of this.npcs.values()) {
      npc.destroy();
    }
    this.npcs.clear();
  }
}
