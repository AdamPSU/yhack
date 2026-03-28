import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from graph.builder import build_graph
from models.schemas import PolicyInput

logger = logging.getLogger(__name__)

router = APIRouter()

simulations: dict[str, PolicyInput] = {}


@router.post("/simulate")
async def start_simulation(policy: PolicyInput):
    simulation_id = str(uuid.uuid4())
    simulations[simulation_id] = policy
    return {"simulation_id": simulation_id}


@router.websocket("/simulate/{simulation_id}/ws")
async def simulation_ws(websocket: WebSocket, simulation_id: str):
    await websocket.accept()

    policy = simulations.get(simulation_id)
    if policy is None:
        await websocket.send_json({"type": "error", "message": "Simulation not found"})
        await websocket.close()
        return

    graph = build_graph()

    initial_state = {
        "policy_text": policy.text,
        "max_rounds": policy.num_rounds,
        "entities": [],
        "npcs": [],
        "relationships": [],
        "events": [],
        "current_round": 0,
    }

    try:
        async for chunk in graph.astream(initial_state):
            if "parse_policy" in chunk:
                update = chunk["parse_policy"]
                await websocket.send_json(
                    {
                        "type": "policy_analysis",
                        "entities": update["entities"],
                    }
                )
            elif "generate_npcs" in chunk:
                update = chunk["generate_npcs"]
                await websocket.send_json(
                    {
                        "type": "init",
                        "npcs": update["npcs"],
                        "relationships": update["relationships"],
                    }
                )
            elif "run_round" in chunk:
                update = chunk["run_round"]
                await websocket.send_json(
                    {
                        "type": "round",
                        "round": update["current_round"] - 1,
                        "events": update["events"],
                        "npcs": update["npcs"],
                    }
                )

        await websocket.send_json({"type": "done"})
    except WebSocketDisconnect:
        pass
    except Exception:
        logger.exception("Simulation %s failed", simulation_id)
        try:
            await websocket.send_json(
                {"type": "error", "message": "Simulation failed unexpectedly"}
            )
        except Exception:
            pass
    finally:
        simulations.pop(simulation_id, None)
        try:
            await websocket.close()
        except Exception:
            pass
