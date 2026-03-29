import logging
import uuid

import socketio
from fastapi import APIRouter

from graph.builder import build_graph
from models.schemas import PolicyInput
from models.state import SimState

logger = logging.getLogger(__name__)

router = APIRouter()

# Socket.IO server (async mode for FastAPI/uvicorn).
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

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


@sio.event
async def start_sim(sid: str, data: dict) -> None:
    """Client emits 'start_sim' with {simulation_id} to begin streaming."""
    simulation_id = data.get("simulation_id", "")
    logger.info("sio start_sim  sid=%s  sim=%s", sid, simulation_id)

    policy = simulations.get(simulation_id)
    if policy is None:
        await sio.emit("sim_error", {"message": "Simulation not found"}, to=sid)
        return

    graph = build_graph()

    async def stream_npc_events(events: list) -> None:
        try:
            await sio.emit("npc_events", {"events": events}, to=sid)
        except Exception:
            pass

    initial_state: SimState = {
        "policy_text": policy.text,
        "max_rounds": policy.num_rounds,
        "entities": [],
        "npcs": [],
        "relationships": [],
        "events": [],
        "current_round": 0,
        "memory_streams": {},
        "npc_stream_callback": stream_npc_events,
    }

    try:
        async for chunk in graph.astream(initial_state):
            if "parse_policy" in chunk:
                update = chunk["parse_policy"]
                logger.info("sim=%s  parse_policy  entities=%d", simulation_id, len(update["entities"]))
                await sio.emit("policy_analysis", {"entities": update["entities"]}, to=sid)

            elif "generate_npcs" in chunk:
                update = chunk["generate_npcs"]
                logger.info("sim=%s  generate_npcs  npcs=%d  rels=%d", simulation_id, len(update["npcs"]), len(update["relationships"]))
                await sio.emit("init", {"npcs": update["npcs"], "relationships": update["relationships"]}, to=sid)

            elif "run_round" in chunk:
                update = chunk["run_round"]
                round_num = update["current_round"] - 1
                logger.info("sim=%s  round %d  events=%d", simulation_id, round_num, len(update["events"]))
                await sio.emit("round", {
                    "round": round_num,
                    "events": update["events"],
                    "npcs": update["npcs"],
                    "influence_events": update.get("influence_events", []),
                }, to=sid)

        logger.info("sim=%s  done", simulation_id)
        await sio.emit("done", {}, to=sid)

    except Exception as exc:
        logger.exception("Simulation %s failed", simulation_id)
        try:
            await sio.emit("sim_error", {"message": f"Simulation failed: {exc}"}, to=sid)
        except Exception:
            pass
    finally:
        simulations.pop(simulation_id, None)
