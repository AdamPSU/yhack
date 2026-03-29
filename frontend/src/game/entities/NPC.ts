import * as Phaser from "phaser";
import type { NPCHoverInfo, NPCState } from "@/types";
import { eventBridge } from "../bridge/EventBridge";
import { TILE_SIZE } from "../config";
import { getNPCTile } from "../map/TileRegistry";

export class NPC extends Phaser.GameObjects.Sprite {
  readonly npcId: string;
  readonly npcName: string;
  readonly charIndex: number;
  role = "";
  sentiment: NPCHoverInfo["sentiment"] = "neutral";

  /** Grid position (in tile coordinates) */
  tileX: number;
  tileY: number;

  direction: NPCState["direction"] = "down";
  npcState: NPCState["state"] = "idle";
  message?: string;

  /** True while a movement tween is running */
  isMoving = false;

  /** True while the pointer is over this NPC */
  isHovered = false;

  /** Active bob tween, stopped on walk completion */
  private bobTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    id: string,
    name: string,
    charIndex: number,
    tileX: number,
    tileY: number,
  ) {
    // Static single-frame character tile — no directional animation
    const frame = getNPCTile(charIndex);
    super(
      scene,
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
      "city-tiles",
      frame,
    );

    this.npcId = id;
    this.npcName = name;
    this.charIndex = charIndex;
    this.tileX = tileX;
    this.tileY = tileY;

    // NPCs render above everything: ground=0, buildings=1, phase overlay=5
    this.setDepth(10);

    // Interactive for hover tooltips
    this.setInteractive({ useHandCursor: true });
    this.on("pointerover", this.onHover, this);
    this.on("pointerout", this.onHoverOut, this);

    scene.add.existing(this);
  }

  /** Track direction for state reporting (sprite stays static) */
  face(dir: NPCState["direction"]) {
    this.direction = dir;
    // Kenney RPG Urban characters are single static tiles — no directional frames.
    // We flip the sprite horizontally when facing left for visual variety.
    this.setFlipX(dir === "left");
  }

  /** Tween-move to an adjacent tile with bob animation. Rejects moves > 2 tiles to prevent teleporting. */
  walkTo(col: number, row: number): Promise<void> {
    if (this.isMoving) return Promise.resolve();

    // Determine direction from delta
    const dx = col - this.tileX;
    const dy = row - this.tileY;

    // Guard: reject long-distance moves to prevent teleporting
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) return Promise.resolve();
    if (dx > 0) this.face("right");
    else if (dx < 0) this.face("left");
    else if (dy > 0) this.face("down");
    else if (dy < 0) this.face("up");

    this.tileX = col;
    this.tileY = row;
    this.isMoving = true;

    const targetY = row * TILE_SIZE + TILE_SIZE / 2;

    // Bob animation: squash-stretch + sway to simulate walking (no Y conflict)
    this.bobTween = this.scene.tweens.add({
      targets: this,
      scaleY: { from: 1.0, to: 0.9 },
      scaleX: { from: 1.0, to: 1.1 },
      angle: { from: -3, to: 3 },
      duration: 80,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        x: col * TILE_SIZE + TILE_SIZE / 2,
        y: targetY,
        duration: 300,
        ease: "Linear",
        onUpdate: () => {
          if (this.isHovered) {
            this.emitHoverEvent();
          }
        },
        onComplete: () => {
          // Stop bob and reset to neutral
          this.bobTween?.stop();
          this.bobTween = undefined;
          this.setScale(1, 1);
          this.setAngle(0);
          this.isMoving = false;
          resolve();
        },
      });
    });
  }

  private emitHoverEvent() {
    eventBridge.emitNPCHover({
      id: this.npcId,
      name: this.npcName,
      role: this.role,
      x: this.x,
      y: this.y,
      sentiment: this.sentiment,
      state: this.npcState,
    });
  }

  private onHover() {
    this.isHovered = true;
    this.emitHoverEvent();
  }

  private onHoverOut() {
    this.isHovered = false;
    eventBridge.emitNPCHoverOut();
  }

  /** Snapshot for EventBridge → React chat bubbles */
  toState(): NPCState {
    return {
      id: this.npcId,
      name: this.npcName,
      x: this.x,
      y: this.y,
      direction: this.direction,
      state: this.npcState,
      message: this.message,
    };
  }
}
