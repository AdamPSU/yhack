import type { SimEvent } from "@/types";
import { eventBridge } from "../bridge/EventBridge";
import { ClosureEffect } from "../effects/ClosureEffect";
import { PriceSpikeEffect } from "../effects/PriceSpikeEffect";
import { ProtestEffect } from "../effects/ProtestEffect";
import type { NPCManager } from "../systems/NPCManager";

/**
 * Listens for SimEvents via EventBridge and dispatches visual effects.
 * Connects the event stream from React/useSimulation to the Phaser world.
 */
export class SimEventHandler {
  private scene: Phaser.Scene;
  private npcManager: NPCManager;
  private protestEffect: ProtestEffect;
  private closureEffect: ClosureEffect;
  private priceSpikeEffect: PriceSpikeEffect;
  /** Track last speaker for NPC-to-NPC conversation detection */
  private lastSpeaker: { npcId: string; time: number } | null = null;

  constructor(scene: Phaser.Scene, npcManager: NPCManager) {
    this.scene = scene;
    this.npcManager = npcManager;
    this.protestEffect = new ProtestEffect(scene, npcManager);
    this.closureEffect = new ClosureEffect(scene);
    this.priceSpikeEffect = new PriceSpikeEffect(scene);

    eventBridge.on("sim:event", this.onSimEvent, this);
  }

  private onSimEvent(event: SimEvent) {
    // Always show chat bubble if there's a message and an agent
    if (event.message && event.agentId !== "system") {
      // Use agentId directly — backend NPC IDs match NPCManager keys
      const npcId = event.agentId;
      this.npcManager.showMessage(npcId, event.message);

      // Detect NPC-to-NPC conversation: if a different NPC spoke recently, walk them together
      if (
        event.type === "reaction" &&
        this.lastSpeaker &&
        this.lastSpeaker.npcId !== npcId &&
        Date.now() - this.lastSpeaker.time < 5000
      ) {
        this.npcManager.converseWith(npcId, this.lastSpeaker.npcId);
        this.lastSpeaker = null; // Reset so we don't chain more meetups
      } else {
        this.lastSpeaker = { npcId, time: Date.now() };
      }
    }

    switch (event.type) {
      case "protest":
        this.handleProtest();
        break;
      case "strike":
        this.handleStrike();
        break;
      case "closure":
        this.handleClosure();
        break;
      case "price_change":
        this.handlePriceChange(event.message);
        break;
      case "mood_shift":
        // No additional visual effect — chat bubble already shown above
        break;
    }
  }

  private handleProtest() {
    // Dynamically pick angry/worried NPCs for the protest (up to 5)
    const allNPCs = this.npcManager.getAllNPCs();
    const protestNPCIds = allNPCs
      .filter((n) => n.sentiment === "angry" || n.sentiment === "worried")
      .slice(0, 5)
      .map((n) => n.npcId);
    // Fallback: if nobody is angry/worried, pick first 3 NPCs
    if (protestNPCIds.length === 0) {
      protestNPCIds.push(...allNPCs.slice(0, 3).map((n) => n.npcId));
    }
    this.protestEffect.trigger(protestNPCIds);
  }

  private handleStrike() {
    // Strike: gather NPCs whose role contains "worker" (up to 3)
    const allNPCs = this.npcManager.getAllNPCs();
    const strikeNPCs = allNPCs
      .filter((n) => n.role.toLowerCase().includes("worker"))
      .slice(0, 3);
    // Fallback: pick first 2 NPCs if no workers found
    if (strikeNPCs.length === 0) {
      strikeNPCs.push(...allNPCs.slice(0, 2));
    }
    const strikeIds = strikeNPCs.map((n) => n.npcId);

    const buildings = this.npcManager.getBuildings();
    const factory = buildings.factories[0];
    if (!factory) return;

    for (const id of strikeIds) {
      const targetCol = factory.x + (strikeIds.indexOf(id) % 3);
      const targetRow = factory.y + 2;
      this.npcManager.sendTo(id, targetCol, targetRow);
    }

    // Release after a while
    this.scene.time.delayedCall(8000, () => {
      for (const id of strikeIds) {
        this.npcManager.releaseNPC(id);
      }
    });
  }

  private handleClosure() {
    // Close a random shop
    const shops = this.npcManager.getBuildings().shops;
    if (shops.length === 0) return;
    const shop = shops[Math.floor(Math.random() * shops.length)];
    this.closureEffect.trigger(shop.x, shop.y);
  }

  private handlePriceChange(message: string) {
    // Show floating price at a random shop
    const shops = this.npcManager.getBuildings().shops;
    if (shops.length === 0) return;
    const shop = shops[Math.floor(Math.random() * shops.length)];
    this.priceSpikeEffect.trigger(shop.x, shop.y, message);
  }

  destroy() {
    eventBridge.off("sim:event", this.onSimEvent, this);
  }
}
