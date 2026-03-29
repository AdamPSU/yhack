import * as Phaser from "phaser";
import type { BuildingPositions } from "@/types";
import { eventBridge } from "../bridge/EventBridge";
import { GAME_HEIGHT, GAME_WIDTH, MAP_COLS, MAP_ROWS } from "../config";
import { SimEventHandler } from "../events/SimEventHandler";
import { NPCManager } from "../systems/NPCManager";

export class WorldScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
  private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private buildingLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private phaseOverlay!: Phaser.GameObjects.Rectangle;
  private npcManager!: NPCManager;
  private simEventHandler!: SimEventHandler;

  constructor() {
    super({ key: "WorldScene" });
  }

  create() {
    // Load the Tiled JSON map
    const map = this.make.tilemap({ key: "city" });
    this.map = map;

    const tileset = map.addTilesetImage("urban", "urban");

    if (!tileset) {
      console.error("Failed to load tileset");
      return;
    }

    // Create layers from the Tiled JSON data
    const groundLayer = map.createLayer("ground", tileset);
    if (!groundLayer) {
      console.error("Failed to create ground layer");
      return;
    }
    this.groundLayer = groundLayer;

    const buildingLayer = map.createLayer("buildings", tileset);
    if (!buildingLayer) {
      console.error("Failed to create building layer");
      return;
    }
    this.buildingLayer = buildingLayer;

    // Set building layer depth above ground
    this.buildingLayer.setDepth(1);

    // Phase-change color overlay (sits above buildings, below NPCs)
    this.phaseOverlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x000000,
      0,
    );
    this.phaseOverlay.setDepth(5);

    // Listen for simulation events via the bridge
    eventBridge.on("sim:phase-change", this.onPhaseChange, this);

    // Camera panning via EventBridge (React click+drag → Phaser camera)
    eventBridge.on("sim:camera-pan", this.onCameraPan, this);

    // ─── NPC System (Agent C) ───
    this.npcManager = new NPCManager(
      this,
      this.getBuildingPositions(),
      this.isWalkable.bind(this),
      this.getGroundGrid(),
    );
    this.simEventHandler = new SimEventHandler(this, this.npcManager);

    // Emit ready state
    this.events.emit("world-ready");
  }

  getBuildingPositions(): BuildingPositions {
    // Derive building positions from the buildings layer data
    // Scan for known building top-left GIDs
    const positions: BuildingPositions = {
      government: { x: 9, y: 5 },
      shops: [],
      factories: [],
      houses: [],
    };

    // Shop#1 top-left GID = 177 (tile 176 + 1)
    // Shop#2 top-left GID = 249 (tile 248 + 1)
    // Long Shop top-left GID = 253 (tile 252 + 1)
    // Factory top-left GID = 227 (tile 226 + 1)
    // House top-left GID = 271 (tile 270 + 1)
    const SHOP1_TL = 177;
    const SHOP2_TL = 249;
    const LONG_SHOP_TL = 253;
    const FACTORY_TL = 227;
    const HOUSE_TL = 271;

    let shopIdx = 0;
    let factoryIdx = 0;
    let houseIdx = 0;

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.buildingLayer?.getTileAt(c, r);
        if (!tile) continue;
        const g = tile.index;

        if (g === FACTORY_TL) {
          positions.factories.push({
            id: `factory-${factoryIdx++}`,
            x: c,
            y: r,
          });
        } else if (g === SHOP1_TL || g === SHOP2_TL || g === LONG_SHOP_TL) {
          positions.shops.push({ id: `shop-${shopIdx++}`, x: c, y: r });
        } else if (g === HOUSE_TL) {
          positions.houses.push({ id: `house-${houseIdx++}`, x: c, y: r });
        }
      }
    }

    return positions;
  }

  getGroundGrid(): number[][] {
    const grid: number[][] = [];
    for (let r = 0; r < MAP_ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.groundLayer?.getTileAt(c, r);
        grid[r][c] = tile ? tile.index : 0;
      }
    }
    return grid;
  }

  isWalkable(col: number, row: number): boolean {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
    if (!this.buildingLayer) return true;
    // getTileAt returns null for empty cells (GID 0 in Tiled JSON → index -1 internally → null when nonNull=false)
    // A non-null tile means a building occupies this cell
    return !this.buildingLayer.getTileAt(col, row);
  }

  // ─── Internal event handlers ───

  private onCameraPan(data: { dx: number; dy: number }) {
    this.cameras.main.scrollX += data.dx;
    this.cameras.main.scrollY += data.dy;
  }

  private onPhaseChange(data: { phase: number; month: number }) {
    // Visual feedback for phase changes — colored overlay with alpha
    const overlays: Record<number, { color: number; alpha: number }> = {
      1: { color: 0x000000, alpha: 0 }, // normal — no overlay
      2: { color: 0xff8800, alpha: 0.08 }, // warm (tension)
      3: { color: 0xff2200, alpha: 0.15 }, // reddish (crisis)
    };
    const { color, alpha } = overlays[data.phase] ?? overlays[1];
    this.phaseOverlay.setFillStyle(color, alpha);
  }

  shutdown() {
    eventBridge.off("sim:phase-change", this.onPhaseChange, this);
    eventBridge.off("sim:camera-pan", this.onCameraPan, this);
    this.simEventHandler?.destroy();
    this.npcManager?.destroy();
  }
}
