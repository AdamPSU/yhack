import type { SimEvent } from "@/lib/types";
import { eventBridge } from "../bridge/EventBridge";
import { ClosureEffect } from "../effects/ClosureEffect";
import { PriceSpikeEffect } from "../effects/PriceSpikeEffect";
import { ProtestEffect } from "../effects/ProtestEffect";
import type { NPCManager } from "../systems/NPCManager";

/**
 * Maps mock-data agentIds → NPC roster IDs.
 * Mock events use human-readable IDs like "gov-official",
 * but NPCManager keys NPCs by roster IDs like "gov_federal".
 */
const AGENT_TO_NPC: Record<string, string> = {
  "gov-official": "gov_federal",
  journalist: "media_outlet",
  "corp-exec": "corp_manufacturing",
  steelworker: "hh_poor_1",
  household: "hh_mc_1",
  "household-2": "hh_hnw_1",
  "auto-dealer": "corp_retail",
  "auto-plant": "corp_retail",
  "sme-owner": "sme_shop",
  "union-rep": "labor_union",
  economist: "gov_central_bank",
  "appliance-mfg": "corp_manufacturing",
  "grocery-store": "sme_shop",
  "construction-co": "corp_manufacturing",
  community: "labor_union",
};

/** Agent IDs that join protests */
const PROTEST_NPCS = [
  "labor_union",
  "hh_mc_1",
  "hh_poor_1",
  "sme_shop",
  "media_outlet",
];
/** Agent IDs that join strikes (at factory) */
const STRIKE_NPCS = ["labor_union", "corp_manufacturing", "hh_poor_1"];

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
      // Resolve mock agentId → NPC roster ID
      const npcId = AGENT_TO_NPC[event.agentId] ?? event.agentId;
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
    }
  }

  private handleProtest() {
    this.protestEffect.trigger(PROTEST_NPCS);
  }

  private handleStrike() {
    // Strike: workers go to factory instead of government
    const buildings = this.npcManager.getBuildings();
    const factory = buildings.factories[0];
    if (!factory) return;

    for (const id of STRIKE_NPCS) {
      const targetCol = factory.x + (STRIKE_NPCS.indexOf(id) % 3);
      const targetRow = factory.y + 2;
      this.npcManager.sendTo(id, targetCol, targetRow);
    }

    // Release after a while
    this.scene.time.delayedCall(8000, () => {
      for (const id of STRIKE_NPCS) {
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
