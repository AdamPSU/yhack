# PolicySim - Economic Policy Simulator

## What This Is
A hackathon project that simulates how economic policies cascade to everyday life. Users input ~500 words of policy text, and 25 LLM-powered NPC agents simulate reactions — from price changes to protests — visualized in a pixel-art SimCity/Pokemon-style world.

## Architecture

```
User → Policy Text → FastAPI POST /simulate → LangGraph Orchestrator
                                                    │
                         ┌──────────────────────────┤
                         ▼                          ▼
                   Parse Policy            Generate 25 NPCs
                         │                          │
                         └──────────┬───────────────┘
                                    ▼
                         ┌─→ Simulation Round ──────┐
                         │  (Perceive→React→Act)    │
                         │  per NPC via LLM          │
                         └── loop N rounds ←────────┘
                                    │
                               WebSocket stream
                                    ▼
                     Next.js + Phaser pixel-art world
```

## Tech Stack
- **Frontend**: Next.js 16 + Phaser 3 + Tailwind CSS v4, Bun
- **Backend**: FastAPI + LangGraph + langchain-anthropic, uv (Python 3.12)
- **Communication**: WebSocket for real-time event streaming

## Project Structure

```
yhack/
├── frontend/                # Next.js + Phaser
│   ├── src/app/             # Next.js pages
│   ├── src/components/      # React components (GameCanvas, PolicyInput, EventFeed)
│   ├── src/game/            # Phaser game code
│   │   ├── config.ts        # Phaser config
│   │   ├── bridge/          # EventBridge singleton (React ↔ Phaser)
│   │   └── scenes/          # BootScene, WorldScene
│   └── src/hooks/           # useSimulation WebSocket hook
├── backend/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings & env vars
│   ├── models/
│   │   ├── schemas.py       # Pydantic models (NPC, SimEvent, etc.)
│   │   └── state.py         # LangGraph state
│   ├── graph/
│   │   ├── builder.py       # StateGraph orchestrator
│   │   ├── prompts.py       # LLM prompt templates
│   │   └── nodes/           # parse_policy, generate_npcs, run_round
│   └── routers/
│       └── simulate.py      # REST + WebSocket endpoints
```

## Commands
- **Frontend dev**: `cd frontend && bun dev`
- **Backend dev**: `cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- **Frontend lint**: `cd frontend && bun lint`
- **Frontend format**: `cd frontend && bun format`

## Key Technical Decisions

1. **Phaser must be client-only**: Use `next/dynamic` with `ssr: false` — Phaser requires browser APIs (canvas, window). The wrapping page must be `"use client"`.
2. **Programmatic pixel art**: BootScene generates textures via `this.make.graphics().generateTexture()` — no external asset files needed.
3. **EventBridge pattern**: A singleton `Phaser.Events.EventEmitter` bridges React (WebSocket data) to Phaser (game rendering). React emits `sim:*` events, Phaser listens.
4. **25 NPC agents**: Parallelized with `asyncio.gather()` in each simulation round. Each NPC follows Perceive → React → Act.
5. **LangGraph `astream`**: Graph streams state updates per node; WebSocket handler forwards events to frontend.
6. **Event queuing**: Frontend queues events with delays (500ms-1s) so simulation plays back cinematically.

## Agent Design (Core Loop per NPC)
- **Perceive**: Read policy summary + neighbor reactions from last round
- **React**: LLM decides emotional/economic reaction based on persona
- **Act**: Output action — chat message, movement, protest, price adjustment, discuss with neighbor

## Environment Variables
Backend `.env` needs:
```
ANTHROPIC_API_KEY=sk-...
```

## Important Notes
- Next.js 16 has breaking changes — always check `node_modules/next/dist/docs/` before using unfamiliar Next.js APIs
- This is a hackathon project — favor speed and demo-ability over robustness
- Frontend runs on port 3000, backend on port 8000
