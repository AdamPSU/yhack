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
│   ├── src/components/      # ChatBubble, Dashboard, EventFeed, GameCanvas, PolicyInput
│   ├── src/game/
│   │   ├── config.ts        # Phaser config
│   │   ├── bridge/          # EventBridge singleton (React ↔ Phaser)
│   │   ├── effects/         # ClosureEffect, PriceSpikeEffect, ProtestEffect
│   │   ├── entities/        # NPC sprite entity
│   │   ├── events/          # SimEventHandler
│   │   ├── map/             # CityGenerator, TileRegistry
│   │   ├── scenes/          # BootScene, WorldScene
│   │   └── systems/         # MovementSystem, NPCManager, OccupancyGrid, Pathfinder
│   ├── src/hooks/           # useSimulation WebSocket hook
│   ├── src/lib/             # adapter, metricsEngine (utility logic)
│   ├── src/mocks/           # mockBackend, mockData (test/placeholder data)
│   ├── src/services/        # wsClient (WebSocket + REST API client)
│   └── src/types/           # index.ts (frontend types), backend.ts (backend types)
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
│   │       ├── parse_policy.py       # Policy analysis node
│   │       ├── npc_orchestrator.py  # NPC generation & relationship node
│   │       └── run_round.py         # Simulation round node
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
- **Perceive**: Read policy summary + nearby NPC info (with relationship annotations) + neighbor reactions from last round
- **React**: LLM decides emotional/economic reaction based on persona
- **Act**: Output action — chat message, movement, protest, price adjustment, discuss with neighbor
- **Post-round influence**: Opinion dynamics applied after all NPCs act (see below)

## Opinion Dynamics (Peralta et al. 2022)
Based on "Opinion dynamics in social networks: From models to data" ([arXiv:2201.01322](https://arxiv.org/abs/2201.01322)).
Implementation in `backend/graph/nodes/run_round.py` → `_apply_opinion_dynamics()`.

### Models Implemented
1. **Deffuant Bounded Confidence** (Eq. 1-2): Pairwise opinion convergence
   - `x_j(t+1) = x_j(t) + μ · I_ij · [x_i(t) - x_j(t)]`
   - Only when `|x_i - x_j| < ε` (confidence bound)
   - Applied to both political leaning ([-1,1]) and mood ([0,1] continuous)
   - μ_political=0.3, μ_mood=0.4, ε_political=0.7, ε_mood=1.1

2. **Baumann Controversy Amplification** (Eq. 6): Polarization under controversy
   - `drift = 0.02 · tanh(α · x_i)` pushes opinions toward extremes
   - α mapped from policy controversy_level: low=1.0, medium=2.0, high=3.5
   - Applied globally to all NPCs each round when α > 1.5

3. **Keep/Compromise/Adopt Classification** (Sec. 3.3, Chacoma & Zanette 2015)
   - I_ij < 0.25 → **Keep** (no change, strangers/weak ties)
   - 0.25 ≤ I_ij < 0.85 → **Compromise** (Deffuant partial convergence)
   - I_ij ≥ 0.85 → **Adopt** (copy speaker's opinion, strong family ties)

### Influence Factor I_ij (Fig. 1c)
`I_ij = min(1.0, relationship_strength × type_weight)` where type_weight:
family=1.5, friend=1.2, employer=1.0, colleague=0.8, neighbor=0.5. Strangers=0.1.

### Spatial Constraints
- NPCs only communicate within Chebyshev distance ≤ 2 (proximity-based, not social graph)
- Movement clamped to 1 tile per round
- Social targets section in prompt tells NPCs where distant friends/family are

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
