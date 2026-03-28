import * as Phaser from "phaser";
import type { BuildingPositions } from "@/lib/types";
import { eventBridge } from "../bridge/EventBridge";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  MAP_COLS,
  MAP_ROWS,
  TILE_SIZE,
} from "../config";
import { SimEventHandler } from "../events/SimEventHandler";
import { type CityGrid, generateCity } from "../map/CityGenerator";
import { NPCManager } from "../systems/NPCManager";

export class WorldScene extends Phaser.Scene {
  private city!: CityGrid;
  private groundLayer!: Phaser.Tilemaps.TilemapLayer;
  private buildingLayer!: Phaser.Tilemaps.TilemapLayer;
  private phaseOverlay!: Phaser.GameObjects.Rectangle;
  private npcManager!: NPCManager;
  private simEventHandler!: SimEventHandler;

  constructor() {
    super({ key: "WorldScene" });
  }

  create() {
    // Generate the procedural city
    this.city = generateCity();

    // Create tilemap from data
    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: MAP_COLS,
      height: MAP_ROWS,
    });

    const tileset = map.addTilesetImage(
      "city-tiles",
      "city-tiles",
      TILE_SIZE,
      TILE_SIZE,
      0,
      0,
    );

    if (!tileset) {
      console.error("Failed to load tileset");
      return;
    }

    // Create ground layer
    const groundLayer = map.createBlankLayer("ground", tileset, 0, 0);
    if (!groundLayer) {
      console.error("Failed to create ground layer");
      return;
    }
    this.groundLayer = groundLayer;

    // Create building/overlay layer
    const buildingLayer = map.createBlankLayer("buildings", tileset, 0, 0);
    if (!buildingLayer) {
      console.error("Failed to create building layer");
      return;
    }
    this.buildingLayer = buildingLayer;

    // Paint ground tiles
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        this.groundLayer.putTileAt(this.city.ground[r][c], c, r);
      }
    }

    // Paint building tiles
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.city.buildings[r][c];
        if (tile !== -1) {
          this.buildingLayer.putTileAt(tile, c, r);
        }
      }
    }

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
      this.getWalkableTiles(),
      this.getBuildingPositions(),
      this.isWalkable.bind(this),
      this.getGroundGrid(),
    );
    this.simEventHandler = new SimEventHandler(this, this.npcManager);

    // Emit ready state
    this.events.emit("world-ready");
  }

  // ─── Public API for Agent C (NPC system) ───

  getWalkableTiles(): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];
    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        if (this.city.walkable[r][c]) {
          tiles.push({ x: c, y: r });
        }
      }
    }
    return tiles;
  }

  getBuildingPositions(): BuildingPositions {
    return this.city.buildingPositions;
  }

  getGroundGrid(): number[][] {
    return this.city.ground;
  }

  isWalkable(col: number, row: number): boolean {
    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
    return this.city.walkable[row][col];
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
