// WebSocket client for communicating with the FastAPI backend

import type {
  WSInitMsg,
  WSMessage,
  WSPolicyAnalysisMsg,
  WSRoundMsg,
} from "./backendTypes";

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000";

export interface WSCallbacks {
  onPolicyAnalysis: (msg: WSPolicyAnalysisMsg) => void;
  onInit: (msg: WSInitMsg) => void;
  onRound: (msg: WSRoundMsg) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * POST to /simulate to create a new simulation, returns the simulation_id.
 */
export async function startSimulation(
  policyText: string,
  numRounds?: number,
): Promise<string> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: policyText, num_rounds: numRounds ?? 75 }),
  });

  if (!res.ok) {
    throw new Error(`Failed to start simulation: ${res.status}`);
  }

  const data = await res.json();
  return data.simulation_id;
}

/**
 * Open a WebSocket to stream simulation events.
 * Returns a cleanup function that closes the connection.
 */
export function connectWebSocket(
  simulationId: string,
  callbacks: WSCallbacks,
): () => void {
  const ws = new WebSocket(`${WS_BASE}/simulate/${simulationId}/ws`);

  ws.onmessage = (event) => {
    let msg: WSMessage;
    try {
      msg = JSON.parse(event.data);
    } catch {
      callbacks.onError("Failed to parse WebSocket message");
      return;
    }

    switch (msg.type) {
      case "policy_analysis":
        callbacks.onPolicyAnalysis(msg);
        break;
      case "init":
        callbacks.onInit(msg);
        break;
      case "round":
        callbacks.onRound(msg);
        break;
      case "done":
        callbacks.onDone();
        break;
      case "error":
        callbacks.onError(msg.message);
        break;
    }
  };

  ws.onerror = () => {
    callbacks.onError("WebSocket connection error");
  };

  ws.onclose = (event) => {
    if (event.code !== 1000) {
      callbacks.onError(`WebSocket closed unexpectedly (code ${event.code})`);
    }
  };

  return () => {
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close();
    }
  };
}
