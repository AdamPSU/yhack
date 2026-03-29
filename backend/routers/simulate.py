import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from graph.builder import build_graph
from models.schemas import PolicyInput
from models.state import SimState

logger = logging.getLogger(__name__)

router = APIRouter()

simulations: dict[str, PolicyInput] = {}


@router.post("/simulate")
async def start_simulation(policy: PolicyInput):
    simulation_id = str(uuid.uuid4())
    simulations[simulation_id] = policy
    logger.info(
        "POST /simulate → id=%s  rounds=%d  policy=%d chars",
        simulation_id,
        policy.num_rounds,
        len(policy.text),
    )
    return {"simulation_id": simulation_id}


@router.websocket("/simulate/{simulation_id}/ws")
async def simulation_ws(websocket: WebSocket, simulation_id: str):
    await websocket.accept()
    logger.info("WS connected  sim=%s", simulation_id)

    policy = simulations.get(simulation_id)
    if policy is None:
        logger.warning("WS sim=%s not found — closing", simulation_id)
        await websocket.send_json({"type": "error", "message": "Simulation not found"})
        await websocket.close()
        return

    graph = build_graph()

    initial_state: SimState = {
        "policy_text": policy.text,
        "objective": policy.objective,
        "max_rounds": policy.num_rounds,
        "num_npcs": policy.num_npcs,
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
                logger.info("sim=%s  ✓ parse_policy  entities=%d", simulation_id, len(update["entities"]))
                await websocket.send_json(
                    {
                        "type": "policy_analysis",
                        "entities": update["entities"],
                    }
                )
            elif "generate_npcs" in chunk:
                update = chunk["generate_npcs"]
                logger.info(
                    "sim=%s  ✓ generate_npcs  npcs=%d  rels=%d",
                    simulation_id,
                    len(update["npcs"]),
                    len(update["relationships"]),
                )
                await websocket.send_json(
                    {
                        "type": "init",
                        "npcs": update["npcs"],
                        "relationships": update["relationships"],
                    }
                )
            elif "run_round" in chunk:
                update = chunk["run_round"]
                round_num = update["current_round"] - 1
                logger.info(
                    "sim=%s  ✓ round %d  events=%d",
                    simulation_id,
                    round_num,
                    len(update["events"]),
                )
                await websocket.send_json(
                    {
                        "type": "round",
                        "round": round_num,
                        "events": update["events"],
                        "npcs": update["npcs"],
                    }
                )

        logger.info("sim=%s  done", simulation_id)
        await websocket.send_json({"type": "done"})
    except WebSocketDisconnect:
        logger.info("sim=%s  client disconnected", simulation_id)
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
