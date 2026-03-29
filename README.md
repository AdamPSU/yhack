# SIMULACRA

**Economic policy simulation with 25 AI agents in a pixel-art city.**

Built at YHack 2026.

<!-- TODO: Add demo GIF here -->
<!-- ![SIMULACRA Demo](docs/demo.gif) -->

## What It Does

1. **Input a policy** -- paste ~500 words of economic policy text (e.g. "Raise minimum wage to $20/hr")
2. **25 NPC agents spawn** -- workers, business owners, politicians, students, retirees, activists, farmers, shopkeepers, and drivers (with car sprites)
3. **15 rounds across 3 phases** -- each NPC perceives the policy, retrieves memories, reflects, plans, and acts
4. **Social influence propagates** -- NPCs influence neighbors via proximity-based opinion dynamics (Deffuant bounded confidence, Baumann polarization, Keep/Compromise/Adopt)
5. **Watch it unfold** -- bankruptcy markers persist on the map, money effects float, emotion faces pop above NPCs, phase flash overlays sweep the screen
6. **Inspect any agent** -- click an NPC or event to see mood, income, political leaning, internal thoughts, and current plan
7. **Analyze results** -- live dashboard tracks price index, unemployment, social unrest; social graph shows relationships as an interactive force layout

```
User -> Policy Text -> FastAPI POST /simulate -> LangGraph Orchestrator
                                                       |
                        +------------------------------+
                        v                              v
                  Parse Policy               Generate 25 NPCs
                        |                              |
                        +--------------+---------------+
                                       v
                            +-> Simulation Round ------+
                            |  Perceive -> Retrieve -> |
                            |  Reflect -> Plan -> Act  |
                            |  per NPC via LLM         |
                            +-- loop 15 rounds <-------+
                                       |
                                  WebSocket stream
                                       v
                        Next.js + Phaser pixel-art world
```

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, Phaser 3 (canvas), Tailwind CSS v4, Bun, Biome |
| Backend | FastAPI, LangGraph, langchain-openai, uv (Python 3.12) |
| LLMs | xAI Grok / K2 Think (configurable via `MODEL_NAME`) |
| Maps | Citypack tileset (100x80, procedural or hand-crafted static) |
| Communication | WebSocket real-time event streaming |

## Quick Start

### Prerequisites

- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- Node.js 22+ with [Bun](https://bun.sh/)
- API key for xAI or K2 Think

### Setup

```bash
git clone <repo-url> && cd yhack

# Backend
cd backend
cp .env .env.local          # add your API keys
uv sync
cd ..

# Frontend
cd frontend
bun install
cd ..
```

### Environment Variables

Create `backend/.env`:

```
XAI_API_KEY=xai-...
K2_API_KEY=...
MODEL_NAME=grok-3-think-v2   # or k2-think-v2
```

### Run

```bash
# Terminal 1 -- Backend (port 8000)
cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 -- Frontend (port 3000)
cd frontend && bun dev
```

## Research Foundations

### Generative Agents (Park et al. 2023)

> Park, J. S. et al. *Generative Agents: Interactive Simulacra of Human Behavior.* [arXiv:2304.03442](https://arxiv.org/abs/2304.03442)

Each NPC runs a cognitive loop adapted from this paper:

- **Memory stream** -- append-only log of observations, reflections, and plans, scored by importance heuristics
- **Retrieval** -- top-K memories scored by `recency * importance * relevance` (Jaccard keyword similarity instead of embeddings)
- **Reflection** -- when recent importance sum exceeds threshold (25), NPC synthesizes higher-level insights stored back into memory
- **Planning** -- single-sentence plans revised each round based on new observations

### Opinion Dynamics (Peralta et al. 2022)

> Peralta, A. F., Kertesz, J., and Iniguez, G. *Opinion dynamics in social networks: From models to data.* [arXiv:2201.01322](https://arxiv.org/abs/2201.01322)

NPC social influence uses three mechanisms:

- **Deffuant Bounded Confidence** -- opinions converge only when close enough (`|x_i - x_j| < e`)
- **Baumann Controversy Amplification** -- high-controversy policies push opinions toward extremes via `tanh(a * x)`
- **Keep/Compromise/Adopt** -- behavioral classification by relationship strength (strangers keep, friends compromise, family adopts)

## Project Structure

```
yhack/
+-- frontend/                   # Next.js 16 + Phaser 3
|   +-- src/app/                # Pages and layouts
|   +-- src/components/         # GameCanvas, PolicyInput, EventFeed, Dashboard,
|   |                           # NPCProfileModal, SocialGraph, EconomicReportModal
|   +-- src/game/
|   |   +-- bridge/             # EventBridge (React <-> Phaser)
|   |   +-- effects/            # ClosureEffect, PriceSpikeEffect, ProtestEffect,
|   |   |                       # EconomicEffects (bankruptcy, money, phase flash, emotion)
|   |   +-- entities/           # NPC, Car, WorldChatBubble
|   |   +-- map/                # CityGenerator, CitypackRegistry, CarRegistry,
|   |   |                       # NPCCharacterRegistry, TileRegistry
|   |   +-- scenes/             # BootScene, WorldScene
|   |   +-- systems/            # MovementSystem, NPCManager, OccupancyGrid, Pathfinder
|   +-- src/hooks/              # useSimulation (WebSocket hook)
|   +-- src/lib/                # adapter, metricsEngine, replayStore
|   +-- src/services/           # wsClient (WebSocket + REST)
|   +-- src/types/              # Frontend + backend type definitions
|   +-- biome.json              # Linting & formatting config
|
+-- backend/                    # FastAPI + LangGraph
|   +-- main.py                 # App entry point
|   +-- config.py               # Grid dims, settings
|   +-- models/                 # Pydantic schemas, LangGraph state
|   +-- graph/                  # LLM nodes, prompts, memory, orchestrator
|   +-- routers/                # HTTP + WebSocket endpoints
|   +-- tests/                  # pytest
|
+-- CLAUDE.md                   # AI assistant instructions
+-- README.md                   # This file
```
