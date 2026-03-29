import * as Phaser from "phaser";

export const TILE_SIZE = 16;
export const MAP_COLS = 80;
export const MAP_ROWS = 60;
export const GAME_WIDTH = MAP_COLS * TILE_SIZE; // 1280
export const GAME_HEIGHT = MAP_ROWS * TILE_SIZE; // 960
export const SCALE_FACTOR = 2; // render at 2x for crisp pixels

// Center bounds for NPC confinement — keeps NPCs in the visible demo area
export const CENTER_BOUNDS = {
  minCol: 11,
  maxCol: 68,
  minRow: 7,
  maxRow: 53,
} as const;

export function createGameConfig(
  parent: string | HTMLElement,
  scenes: Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent,
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: scenes,
    backgroundColor: "#1a1510",
  };
}
