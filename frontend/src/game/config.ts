import Phaser from "phaser";

export const TILE_SIZE = 16;
export const MAP_COLS = 40;
export const MAP_ROWS = 30;
export const GAME_WIDTH = MAP_COLS * TILE_SIZE; // 640
export const GAME_HEIGHT = MAP_ROWS * TILE_SIZE; // 480
export const SCALE_FACTOR = 2; // render at 2x for crisp pixels

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
    backgroundColor: "#1a1a2e",
  };
}
