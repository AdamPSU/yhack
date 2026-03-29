import * as Phaser from "phaser";
import type { BuildingPositions } from "@/types";
import { eventBridge } from "../bridge/EventBridge";
import {
  CENTER_BOUNDS,
  GAME_HEIGHT,
  GAME_WIDTH,
  TILE_SIZE,
  getMapConfig,
  proceduralMap,
  selectedMap,
} from "../config";
import { SimEventHandler } from "../events/SimEventHandler";
import { ChunkManager } from "../map/ChunkManager";
import { CitypackChunkManager } from "../map/CitypackChunkManager";
import { isRoad as citypackIsRoad } from "../map/CitypackProceduralCity";
import { isRoad as ccityIsRoad } from "../map/ProceduralCity";
import { ROAD_TILES as CITYPACK_ROAD_TILES } from "../map/CitypackRegistry";
import { NPCManager } from "../systems/NPCManager";

export class WorldScene extends Phaser.Scene {
  // Static map (fallback)
  private staticMap?: Phaser.Tilemaps.Tilemap;
  private staticGroundLayer?: Phaser.Tilemaps.TilemapLayer;
  private staticBuildingLayer?: Phaser.Tilemaps.TilemapLayer;

  // Infinite procedural map
  private chunkManager?: ChunkManager;
  private useChunks = false;

  // Citypack procedural map
  private citypackChunkManager?: CitypackChunkManager;
  private useCitypackChunks = false;

  private phaseOverlay!: Phaser.GameObjects.Rectangle;
  private npcManager!: NPCManager;
  private simEventHandler!: SimEventHandler;

  constructor() {
    super({ key: "WorldScene" });
  }

  create() {
    if (selectedMap === "citypack") {
      if (proceduralMap) {
        try {
          this.citypackChunkManager = new CitypackChunkManager(this);
          if (this.citypackChunkManager.isReady()) {
            this.useCitypackChunks = true;
            this.citypackChunkManager.update(this.cameras.main);
          }
        } catch (e) {
          console.warn("CitypackChunkManager failed:", e);
        }
      }
      // If !proceduralMap, fall through to initStaticMap()
    } else if (selectedMap !== "pico8") {
      try {
        this.chunkManager = new ChunkManager(this);
        if (this.chunkManager.isReady()) {
          this.useChunks = true;
          this.chunkManager.update(this.cameras.main);
        }
      } catch (e) {
        console.warn("ChunkManager failed, falling back to static map:", e);
        this.useChunks = false;
      }
    }

    // Fallback or pico8: load static Tiled JSON map
    if (!this.useChunks && !this.useCitypackChunks) {
      this.initStaticMap();
    }

    // Pico-8 map is 440×240px — zoom and center it to fill the canvas
    if (!this.useChunks && selectedMap === "pico8") {
      const mc = getMapConfig(); // { tileSize: 8, cols: 55, rows: 30 }
      const mapPixelW = mc.cols * mc.tileSize; // 440
      const mapPixelH = mc.rows * mc.tileSize; // 240
      const zoom = Math.min(GAME_WIDTH / mapPixelW, GAME_HEIGHT / mapPixelH);
      this.cameras.main.setZoom(zoom);
      this.cameras.main.centerOn(mapPixelW / 2, mapPixelH / 2);
    }

    // Citypack static map is 100×80 at 16px = 1600×1280px — center camera on map
    if (
      !this.useChunks &&
      !this.useCitypackChunks &&
      selectedMap === "citypack"
    ) {
      this.cameras.main.centerOn((100 * 16) / 2, (80 * 16) / 2);
    }

    // Snap camera to integer pixels to prevent tile seams during pan/zoom
    this.cameras.main.roundPixels = true;

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
    eventBridge.on("sim:camera-snap-npc", this.onCameraSnapNPC, this);

    // ─── NPC System ───
    this.npcManager = new NPCManager(
      this,
      this.getBuildingPositions(),
      this.isWalkable.bind(this),
      this.getIsRoad(),
    );
    this.simEventHandler = new SimEventHandler(this, this.npcManager);

    // Emit ready state
    this.events.emit("world-ready");
  }

  update() {
    if (this.useChunks && this.chunkManager) {
      this.chunkManager.update(this.cameras.main);
    }
    if (this.useCitypackChunks && this.citypackChunkManager) {
      this.citypackChunkManager.update(this.cameras.main);
    }
  }

  // ─── Static map initialization (fallback) ───

  private initStaticMap() {
    let mapKey: string;
    let tilesetKey: string;
    let tilesetName: string;
    let groundLayerName: string;
    let buildingLayerName: string;

    if (selectedMap === "citypack") {
      mapKey = "citypack-city";
      tilesetKey = "citypack";
      tilesetName = "citypack";
      groundLayerName = "Terrain";
      buildingLayerName = "Objects";
    } else if (selectedMap === "pico8") {
      mapKey = "city";
      tilesetKey = "pico8";
      tilesetName = "city-tileset";
      groundLayerName = "Terrain";
      buildingLayerName = "Objects";
    } else {
      mapKey = "city";
      tilesetKey = "urban";
      tilesetName = "urban";
      groundLayerName = "ground";
      buildingLayerName = "buildings";
    }

    const mc = getMapConfig();
    const map = this.make.tilemap({ key: mapKey });
    this.staticMap = map;

    const tileset = map.addTilesetImage(
      tilesetName,
      tilesetKey,
      mc.tileSize,
      mc.tileSize,
      0,
      mc.spacing,
    );
    if (!tileset) {
      console.error("Failed to load tileset");
      return;
    }

    const groundLayer = map.createLayer(groundLayerName, tileset);
    if (!groundLayer) {
      console.error("Failed to create ground layer");
      return;
    }
    this.staticGroundLayer = groundLayer;

    const buildingLayer = map.createLayer(buildingLayerName, tileset);
    if (!buildingLayer) {
      console.error("Failed to create building layer");
      return;
    }
    this.staticBuildingLayer = buildingLayer;
    this.staticBuildingLayer.setDepth(1);
  }

  // ─── Shared tile queries (delegate to chunks or static) ───

  getBuildingPositions(): BuildingPositions {
    if (this.useCitypackChunks && this.citypackChunkManager) {
      return this.citypackChunkManager.getBuildingPositions(
        CENTER_BOUNDS.minCol,
        CENTER_BOUNDS.minRow,
        CENTER_BOUNDS.maxCol,
        CENTER_BOUNDS.maxRow,
      );
    }

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

    const mc = getMapConfig();
    for (let r = 0; r < mc.rows; r++) {
      for (let c = 0; c < mc.cols; c++) {
        const tile = this.staticBuildingLayer.getTileAt(c, r);
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

  /** Returns a road-check function based on the active map type */
  private getIsRoad(): (col: number, row: number) => boolean {
    if (this.useCitypackChunks) {
      // CitypackProceduralCity.isRoad takes (worldRow, worldCol) — swap
      return (col, row) => citypackIsRoad(row, col);
    }
    if (this.useChunks) {
      // ProceduralCity.isRoad takes (worldRow, worldCol) — swap
      return (col, row) => ccityIsRoad(row, col);
    }
    // Static citypack: check ground tile GID against known road GIDs
    if (selectedMap === "citypack" && this.staticGroundLayer) {
      return (col, row) => {
        const tile = this.staticGroundLayer!.getTileAt(col, row);
        return tile !== null && CITYPACK_ROAD_TILES.has(tile.index);
      };
    }
    // pico8 / ccity static fallback: any non-building tile is walkable-as-road
    return (col, row) => this.isWalkable(col, row);
  }

  isWalkable(col: number, row: number): boolean {
    if (this.useCitypackChunks && this.citypackChunkManager) {
      return this.citypackChunkManager.isWalkable(col, row);
    }

    if (this.useChunks && this.chunkManager) {
      return this.chunkManager.isWalkable(col, row);
    }

    // Static map — use actual map dimensions
    const mc = getMapConfig();
    if (col < 0 || col >= mc.cols || row < 0 || row >= mc.rows) return false;
    return !this.staticBuildingLayer?.getTileAt(col, row);
  }

  // ─── Internal event handlers ───

  private onCameraPan(data: { dx: number; dy: number }) {
    this.cameras.main.scrollX = Math.round(this.cameras.main.scrollX + data.dx);
    this.cameras.main.scrollY = Math.round(this.cameras.main.scrollY + data.dy);
  }

  private onCameraZoom(data: { delta: number }) {
    const cam = this.cameras.main;
    const newZoom = Phaser.Math.Clamp(cam.zoom + data.delta * 0.1, 0.5, 3.0);
    cam.zoom = newZoom;
  }

  private onCameraSnapNPC(data: { npcId: string }) {
    const npc = this.npcManager?.getNPC(data.npcId);
    if (!npc) return;
    const targetX = npc.tileX * TILE_SIZE + TILE_SIZE / 2;
    const targetY = npc.tileY * TILE_SIZE + TILE_SIZE / 2;
    this.cameras.main.pan(targetX, targetY, 400, "Power2");
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
    eventBridge.off("sim:camera-snap-npc", this.onCameraSnapNPC, this);
    this.simEventHandler?.destroy();
    this.npcManager?.destroy();
    this.chunkManager?.destroy();
    this.citypackChunkManager?.destroy();
  }
}
