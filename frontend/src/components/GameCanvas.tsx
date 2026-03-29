"use client";

import { useEffect, useRef } from "react";
import { GAME_WIDTH, GAME_HEIGHT, SCALE_FACTOR } from "@/game/config";

/**
 * GameCanvas wraps the Phaser game instance.
 * Agent A builds the real scenes (BootScene, WorldScene) in a separate worktree.
 * This component uses a fallback placeholder scene until those are available.
 */
export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let destroyed = false;

    async function initGame() {
      const Phaser = await import("phaser");
      const { createGameConfig, setSelectedMap } = await import("@/game/config");

      // Read map param from URL and set before Phaser initializes
      const params = new URLSearchParams(window.location.search);
      const mapParam = params.get("map");
      if (mapParam === "pico8" || mapParam === "ccity" || mapParam === "citypack") {
        setSelectedMap(mapParam);
      }

      // Try to load the real scenes from Agent A's build
      // turbopackOptional suppresses build errors when these files don't exist yet
      let scenes: Phaser.Types.Scenes.SceneType[];
      try {
        const { BootScene } = await import(
          /* turbopackOptional: true */ "@/game/scenes/BootScene"
        );
        const { WorldScene } = await import(
          /* turbopackOptional: true */ "@/game/scenes/WorldScene"
        );
        scenes = [BootScene, WorldScene];
      } catch {
        // Fallback placeholder scene with warm theme
        scenes = [
          class PlaceholderScene extends Phaser.Scene {
            constructor() {
              super({ key: "PlaceholderScene" });
            }
            create() {
              // Warm grid background
              const g = this.add.graphics();
              g.lineStyle(1, 0x3a2e1e, 0.4);
              for (let x = 0; x <= GAME_WIDTH; x += 16) {
                g.moveTo(x, 0);
                g.lineTo(x, GAME_HEIGHT);
              }
              for (let y = 0; y <= GAME_HEIGHT; y += 16) {
                g.moveTo(0, y);
                g.lineTo(GAME_WIDTH, y);
              }
              g.strokePath();

              // Title
              this.add
                .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, "AGORA", {
                  fontSize: "28px",
                  color: "#e8a43a",
                  fontFamily: "monospace",
                  fontStyle: "bold",
                })
                .setOrigin(0.5);

              this.add
                .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 16, "Loading city...", {
                  fontSize: "12px",
                  color: "#8a7a62",
                  fontFamily: "monospace",
                })
                .setOrigin(0.5);

              // Pulsing dot
              const dot = this.add.circle(
                GAME_WIDTH / 2,
                GAME_HEIGHT / 2 + 40,
                3,
                0xe8a43a,
              );
              this.tweens.add({
                targets: dot,
                alpha: 0.2,
                duration: 800,
                yoyo: true,
                repeat: -1,
              });
            }
          },
        ];
      }

      if (destroyed) return;

      const config = createGameConfig(containerRef.current!, scenes);
      gameRef.current = new Phaser.Game(config);
    }

    initGame();

    return () => {
      destroyed = true;
      if (gameRef.current) {
        (gameRef.current as { destroy: (b: boolean) => void }).destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="game-canvas"
      className="rpg-panel overflow-hidden pixel-crisp box-border"
      style={{
        width: GAME_WIDTH * SCALE_FACTOR + 4,
        height: GAME_HEIGHT * SCALE_FACTOR + 4,
      }}
    />
  );
}
