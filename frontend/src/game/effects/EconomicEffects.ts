import * as Phaser from "phaser";

/** Spawn a floating text that drifts up and fades — SimCity style */
export function floatText(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  text: string,
  color: string = "#ffffff",
  fontSize = 14,
) {
  const txt = scene.add
    .text(worldX, worldY, text, {
      fontSize: `${fontSize}px`,
      color,
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 2,
    })
    .setDepth(20)
    .setOrigin(0.5, 1);

  scene.tweens.add({
    targets: txt,
    y: worldY - 60,
    alpha: { from: 1, to: 0 },
    duration: 2000,
    ease: "Power2",
    onComplete: () => txt.destroy(),
  });
}

/** Protest → red bankruptcy sign floating up */
export function spawnBankruptcy(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
) {
  floatText(scene, worldX, worldY, "BANKRUPT", "#ff4444", 13);
  floatText(
    scene,
    worldX + Phaser.Math.Between(-20, 20),
    worldY - 10,
    "---",
    "#ff6666",
    18,
  );
}

/** Price spike → money draining */
export function spawnMoneyLoss(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
) {
  floatText(scene, worldX, worldY, "-$$$", "#ff8800", 14);
}

/** Price drop / good economy → money in */
export function spawnMoneyGain(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
) {
  floatText(scene, worldX, worldY, "+$", "#44ff88", 14);
}

/** Phase change → full screen flash */
export function spawnPhaseFlash(
  scene: Phaser.Scene,
  phase: number,
  gameW: number,
  gameH: number,
) {
  const colors: Record<number, number> = {
    1: 0x00ff88,
    2: 0xff8800,
    3: 0xff2200,
  };
  const labels: Record<number, string> = {
    1: "POLICY ANNOUNCED",
    2: "ECONOMIC PRESSURE",
    3: "SOCIAL CRISIS",
  };
  const color = colors[phase] ?? 0xffffff;
  const rect = scene.add
    .rectangle(gameW / 2, gameH / 2, gameW * 4, gameH * 4, color, 0.3)
    .setDepth(6)
    .setScrollFactor(0);
  const label = scene.add
    .text(gameW / 2, gameH / 2, labels[phase] ?? `PHASE ${phase}`, {
      fontSize: "22px",
      color: "#ffffff",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 3,
    })
    .setDepth(7)
    .setOrigin(0.5)
    .setScrollFactor(0);

  scene.tweens.add({
    targets: [rect, label],
    alpha: { from: 1, to: 0 },
    duration: 2500,
    ease: "Power2",
    onComplete: () => {
      rect.destroy();
      label.destroy();
    },
  });
}

/** Emotion bubble above NPC head */
export function spawnEmotionBubble(
  scene: Phaser.Scene,
  worldX: number,
  worldY: number,
  sentiment: string,
) {
  const label =
    sentiment === "angry" ? ">:(" : sentiment === "happy" ? ":)" : ":|";
  const txt = scene.add
    .text(worldX, worldY - 24, label, {
      fontSize: "14px",
      fontFamily: "monospace",
      stroke: "#000000",
      strokeThickness: 2,
      color:
        sentiment === "angry"
          ? "#ff4444"
          : sentiment === "happy"
            ? "#44ff88"
            : "#cccccc",
    })
    .setDepth(20)
    .setOrigin(0.5, 1);
  scene.tweens.add({
    targets: txt,
    y: worldY - 70,
    alpha: { from: 1, to: 0 },
    scaleX: { from: 0.5, to: 1.2 },
    scaleY: { from: 0.5, to: 1.2 },
    duration: 1800,
    ease: "Back.easeOut",
    onComplete: () => txt.destroy(),
  });
}
