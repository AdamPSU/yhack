// Socket.IO client for communicating with the FastAPI backend

import { io, type Socket } from "socket.io-client";
import type {
  BackendSimEvent,
  WSInitMsg,
  WSNPCEventsMsg,
  WSPolicyAnalysisMsg,
  WSRoundMsg,
} from "@/types/backend";

const API_BASE = "http://localhost:8000";

export interface WSCallbacks {
  onPolicyAnalysis: (msg: WSPolicyAnalysisMsg) => void;
  onInit: (msg: WSInitMsg) => void;
  onRound: (msg: WSRoundMsg) => void;
  onNPCEvents?: (msg: WSNPCEventsMsg) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * POST to /simulate to create a new simulation, returns the simulation_id.
 */
export async function extractFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/extract`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Extraction failed: ${res.status}`);
  const data = await res.json();
  return data.text as string;
}

export async function startSimulation(
  policyText: string,
  numRounds?: number,
  numNpcs?: number,
  objective?: string,
  mapId?: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: policyText,
      num_rounds: numRounds ?? 75,
      num_npcs: numNpcs ?? 25,
      objective: objective ?? "",
      map_id: mapId ?? "ccity",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to start simulation: ${res.status}`);
  }

  const data = await res.json();
  return data.simulation_id;
}

/**
 * Connect via Socket.IO and start streaming simulation events.
 * Returns a cleanup function that disconnects the socket.
 */
export function connectSimulation(
  simulationId: string,
  callbacks: WSCallbacks,
): () => void {
  const socket: Socket = io(API_BASE, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    socket.emit("start_sim", { simulation_id: simulationId });
  });

  socket.on("policy_analysis", (data: WSPolicyAnalysisMsg) => {
    callbacks.onPolicyAnalysis(data);
  });

  socket.on("init", (data: WSInitMsg) => {
    callbacks.onInit(data);
  });

  socket.on("round", (data: WSRoundMsg) => {
    callbacks.onRound(data);
  });

  socket.on("npc_events", (data: WSNPCEventsMsg) => {
    callbacks.onNPCEvents?.(data);
  });

  socket.on("done", () => {
    callbacks.onDone();
  });

  socket.on("sim_error", (data: { message: string }) => {
    callbacks.onError(data.message);
  });

  socket.on("connect_error", (err: Error) => {
    callbacks.onError(`Connection error: ${err.message}`);
  });

  socket.on("disconnect", (reason: string) => {
    if (reason !== "io client disconnect") {
      callbacks.onError(`Disconnected: ${reason}`);
    }
  });

  return () => {
    socket.disconnect();
  };
}
