# PolicySim - Economic Policy Simulator

## What This Is
A hackathon project that simulates how economic policies cascade to everyday life. Users input ~500 words of policy text, and 25 LLM-powered NPC agents simulate reactions — from price changes to protests — visualized in a pixel-art SimCity/Pokemon-style world.

## Tech Stack
- **Frontend**: Next.js 16 + Phaser 3 + Tailwind CSS v4, Bun
  - Biome 2.2.0 for linting & formatting (not ESLint)
  - React Compiler enabled
- **Backend**: FastAPI + LangGraph + langchain-openai, uv (Python 3.12)
  - LLM models (swap via `MODEL_NAME` in `.env`):
    - `grok-3-think-v2` — xAI API (`https://api.x.ai/v1`)
    - `k2-think-v2` — K2 Think API (`https://api.k2think.ai/v1`)
- **Communication**: WebSocket for real-time event streaming

## Project Structure

```
yhack/
├── frontend/                # Next.js + Phaser
│   ├── AGENTS.md            # Next.js 16 migration notes
│   ├── biome.json           # Linting & formatting config
│   ├── src/app/
│   │   ├── layout.tsx       # RootLayout (Geist fonts)
│   │   ├── page.tsx         # Main page (currently scaffold)
│   │   └── globals.css      # Tailwind CSS + CSS vars
│   │
│   │  ── Planned ──────────────────────────────────
│   ├── src/components/      # GameCanvas, PolicyInput, EventFeed
│   ├── src/game/
│   │   ├── config.ts        # Phaser config
│   │   ├── bridge/          # EventBridge singleton (React ↔ Phaser)
│   │   └── scenes/          # BootScene, WorldScene
│   └── src/hooks/           # useSimulation WebSocket hook
│
├── backend/
│   ├── main.py              # FastAPI app (CORS, router mount)
│   ├── config.py            # Settings & env vars, grid dims
│   ├── models/
│   │   ├── schemas.py       # Pydantic models (NPC, Relationship, SimEvent, PolicyInput)
│   │   └── state.py         # LangGraph SimState TypedDict
│   ├── graph/
│   │   ├── builder.py       # StateGraph orchestrator
│   │   ├── prompts.py       # LLM prompt templates
│   │   ├── llm.py           # ChatAnthropic factory
│   │   ├── utils.py         # parse_llm_json helper
│   │   └── nodes/
│   │       ├── parse_policy.py   # Policy analysis node
│   │       ├── generate_npcs.py  # NPC generation node
│   │       └── run_round.py      # Simulation round node
│   ├── routers/
│   │   └── simulate.py      # POST /simulate + WebSocket /simulate/{id}/ws
│   └── tests/               # pytest + pytest-asyncio
```

## Commands
- **Frontend dev**: `cd frontend && bun dev`
- **Backend dev**: `cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- **Frontend lint**: `cd frontend && bun lint` (runs `biome check`)
- **Frontend format**: `cd frontend && bun format` (runs `biome format --write`)

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

## Config & Constants
- **Grid**: 20×15 (`GRID_WIDTH`, `GRID_HEIGHT` in `config.py`)
- **NPCs**: 25 max (`MAX_NPCS`), 30-40 relationships generated
- **Simulation**: 5 rounds default (`max_rounds`)
- **LLM**: max_tokens=4096
- **CORS**: allows `localhost:3000`

## Environment Variables
Backend `.env` needs:
```
XAI_API_KEY=xai-...
K2_API_KEY=...
MODEL_NAME=grok-3-think-v2   # or k2-think-v2
```

## Important Notes
- Next.js 16 has breaking changes — see `frontend/AGENTS.md` and check `node_modules/next/dist/docs/` before using unfamiliar Next.js APIs
- This is a hackathon project — favor speed and demo-ability over robustness
- Frontend runs on port 3000, backend on port 8000
