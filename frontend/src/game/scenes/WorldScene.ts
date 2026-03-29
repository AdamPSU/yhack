import * as Phaser from "phaser";
import type { BuildingPositions } from "@/lib/types";
import { eventBridge } from "../bridge/EventBridge";
import { CENTER_BOUNDS, GAME_HEIGHT, GAME_WIDTH, MAP_COLS, MAP_ROWS } from "../config";
import { SimEventHandler } from "../events/SimEventHandler";
import { ChunkManager } from "../map/ChunkManager";
import { NPCManager } from "../systems/NPCManager";

export class WorldScene extends Phaser.Scene {
  // Static map (fallback)
  private staticMap?: Phaser.Tilemaps.Tilemap;
  private staticGroundLayer?: Phaser.Tilemaps.TilemapLayer;
  private staticBuildingLayer?: Phaser.Tilemaps.TilemapLayer;

  // Infinite procedural map
  private chunkManager?: ChunkManager;
  private useChunks = false;

  private phaseOverlay!: Phaser.GameObjects.Rectangle;
  private npcManager!: NPCManager;
  private simEventHandler!: SimEventHandler;

  constructor() {
    super({ key: "WorldScene" });
  }

  create() {
    // Try chunk-based infinite map first
    try {
      this.chunkManager = new ChunkManager(this);
      if (this.chunkManager.isReady()) {
        this.useChunks = true;
        // Load initial chunks around origin (where the city starts)
        this.chunkManager.update(this.cameras.main);
      }
    } catch (e) {
      console.warn("ChunkManager failed, falling back to static map:", e);
      this.useChunks = false;
    }

    // Fallback: load static Tiled JSON map
    if (!this.useChunks) {
      this.initStaticMap();
    }

    // Phase-change color overlay (sits above buildings, below NPCs)
    this.phaseOverlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH * 4, // larger to cover zoom-out
      GAME_HEIGHT * 4,
      0x000000,
      0,
    );
    this.phaseOverlay.setDepth(5);
    this.phaseOverlay.setScrollFactor(0); // stays fixed on screen

    // Listen for simulation events via the bridge
    eventBridge.on("sim:phase-change", this.onPhaseChange, this);
    eventBridge.on("sim:camera-pan", this.onCameraPan, this);
    eventBridge.on("sim:camera-zoom", this.onCameraZoom, this);

    // ─── NPC System ───
    // When using chunks, the ground grid is relative to CENTER_BOUNDS
    const gridRowOffset = this.useChunks ? CENTER_BOUNDS.minRow : 0;
    const gridColOffset = this.useChunks ? CENTER_BOUNDS.minCol : 0;
    this.npcManager = new NPCManager(
      this,
      this.getBuildingPositions(),
      this.isWalkable.bind(this),
      this.getGroundGrid(),
      gridRowOffset,
      gridColOffset,
    );
    this.simEventHandler = new SimEventHandler(this, this.npcManager);

    // Emit ready state
    this.events.emit("world-ready");
  }

  update() {
    // Update chunk loading/unloading based on camera position
    if (this.useChunks && this.chunkManager) {
      this.chunkManager.update(this.cameras.main);
    }
  }

  // ─── Static map initialization (fallback) ───

  private initStaticMap() {
    const map = this.make.tilemap({ key: "city" });
    this.staticMap = map;

    const tileset = map.addTilesetImage("urban", "urban");
    if (!tileset) {
      console.error("Failed to load tileset");
      return;
    }

    const groundLayer = map.createLayer("ground", tileset);
    if (!groundLayer) {
      console.error("Failed to create ground layer");
      return;
    }
    this.staticGroundLayer = groundLayer;

    const buildingLayer = map.createLayer("buildings", tileset);
    if (!buildingLayer) {
      console.error("Failed to create building layer");
      return;
    }
    this.staticBuildingLayer = buildingLayer;
    this.staticBuildingLayer.setDepth(1);
  }

  // ─── Shared tile queries (delegate to chunks or static) ───

  getBuildingPositions(): BuildingPositions {
    if (this.useChunks && this.chunkManager) {
      return this.chunkManager.getBuildingPositions(
        CENTER_BOUNDS.minCol,
        CENTER_BOUNDS.minRow,
        CENTER_BOUNDS.maxCol,
        CENTER_BOUNDS.maxRow,
      );
    }

    // Static map scan
    const positions: BuildingPositions = {
      government: { x: 9, y: 5 },
      shops: [],
      factories: [],
      houses: [],
    };

    if (!this.staticBuildingLayer) return positions;

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
        const tile = this.staticBuildingLayer.getTileAt(c, r);
        if (!tile) continue;
        const g = tile.index;

        if (g === FACTORY_TL) {
          positions.factories.push({ id: `factory-${factoryIdx++}`, x: c, y: r });
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
    if (this.useChunks && this.chunkManager) {
      return this.chunkManager.getGroundGrid(
        CENTER_BOUNDS.minCol,
        CENTER_BOUNDS.minRow,
        CENTER_BOUNDS.maxCol,
        CENTER_BOUNDS.maxRow,
      );
    }

    // Static map
    const grid: number[][] = [];
    for (let r = 0; r < MAP_ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.staticGroundLayer?.getTileAt(c, r);
        grid[r][c] = tile ? tile.index : 0;
      }
    }
    return grid;
  }

  isWalkable(col: number, row: number): boolean {
    if (this.useChunks && this.chunkManager) {
      return this.chunkManager.isWalkable(col, row);
    }

    // Static map
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
    return !this.staticBuildingLayer?.getTileAt(col, row);
  }

  // ─── Internal event handlers ───

  private onCameraPan(data: { dx: number; dy: number }) {
    this.cameras.main.scrollX += data.dx;
    this.cameras.main.scrollY += data.dy;
  }

  private onCameraZoom(data: { delta: number }) {
    const cam = this.cameras.main;
    const newZoom = Phaser.Math.Clamp(cam.zoom + data.delta * 0.1, 0.5, 3.0);
    cam.zoom = newZoom;
  }

  private onPhaseChange(data: { phase: number; month: number }) {
    const overlays: Record<number, { color: number; alpha: number }> = {
      1: { color: 0x000000, alpha: 0 },
      2: { color: 0xff8800, alpha: 0.08 },
      3: { color: 0xff2200, alpha: 0.15 },
    };
    const { color, alpha } = overlays[data.phase] ?? overlays[1];
    this.phaseOverlay.setFillStyle(color, alpha);
  }

  shutdown() {
    eventBridge.off("sim:phase-change", this.onPhaseChange, this);
    eventBridge.off("sim:camera-pan", this.onCameraPan, this);
    eventBridge.off("sim:camera-zoom", this.onCameraZoom, this);
    this.simEventHandler?.destroy();
    this.npcManager?.destroy();
    this.chunkManager?.destroy();
  }
}
