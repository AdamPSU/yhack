import * as Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // Show loading bar
    const { width, height } = this.cameras.main;
    const barW = width * 0.6;
    const barH = 12;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x222244, 1);
    bg.fillRect(barX, barY, barW, barH);

    const fill = this.add.graphics();
    this.load.on("progress", (value: number) => {
      fill.clear();
      fill.fillStyle(0x4488ff, 1);
      fill.fillRect(barX + 2, barY + 2, (barW - 4) * value, barH - 4);
    });

    const text = this.add.text(width / 2, barY - 24, "Loading SIMULACRA...", {
      fontSize: "14px",
      color: "#aabbee",
    });
    text.setOrigin(0.5);

    // Load Tiled JSON map + CCity tileset image
    this.load.tilemapTiledJSON("city", "/assets/maps/city.json");
    this.load.image("urban", "/assets/citymap_tilesets/CCity_mockup.png");

    // Keep old spritesheet for NPC sprites (still uses Kenney RPG Urban Pack)
    this.load.spritesheet("city-tiles", "/assets/tilesets/tilemap_packed.png", {
      frameWidth: 16,
      frameHeight: 16,
      margin: 0,
      spacing: 0,
    });
  }

  create() {
    this.scene.start("WorldScene");
  }
}
