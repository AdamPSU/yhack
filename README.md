# PolicySim

Simulate how economic policies cascade to everyday life. Input ~500 words of policy text, and 25 LLM-powered NPC agents react in real time — protesting, adjusting prices, shifting opinions — visualized in a pixel-art world.

Built at YHack 2026.

## How It Works

1. You paste a policy (e.g. "Raise minimum wage to $20/hr")
2. An LLM analyzes affected sectors, stakeholders, and controversy level
3. 25 diverse NPC personas are generated — workers, shopkeepers, politicians, farmers
4. Over 5 simulation rounds, each NPC perceives the policy, reacts emotionally, and acts
5. NPCs influence each other through proximity-based social dynamics grounded in [opinion dynamics research](https://arxiv.org/abs/2201.01322)
6. Everything streams live to a pixel-art frontend via WebSocket

```
User -> Policy Text -> FastAPI POST /simulate -> LangGraph Orchestrator
                                                       |
                        +------------------------------+
                        v                              v
                  Parse Policy               Generate 25 NPCs
                        |                              |
                        +--------------+---------------+
                                       v
                            +-> Simulation Round -----+
                            |  (Perceive->React->Act) |
                            |  per NPC via LLM        |
                            +-- loop N rounds <-------+
                                       |
                                  WebSocket stream
                                       v
                        Next.js + Phaser pixel-art world
```

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 16, Phaser 3, Tailwind CSS v4, Bun |
| Backend | FastAPI, LangGraph, langchain-openai, uv (Python 3.12) |
| LLMs | xAI Grok / K2 Think (swap via `MODEL_NAME` env var) |
| Communication | WebSocket for real-time event streaming |

## Quick Start

### Prerequisites

- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- Node.js 22+ with [Bun](https://bun.sh/)
- An API key for xAI or K2 Think

### Setup

```bash
git clone <repo-url> && cd yhack

# Backend
cd backend
cp .env .env.local          # add your API keys to .env.local
uv sync
cd ..

# Frontend
cd frontend
bun install
cd ..
```

### Environment Variables

Create `backend/.env` with:

```
XAI_API_KEY=xai-...
K2_API_KEY=...
MODEL_NAME=grok-4.20-non-reasoning   # or k2-think-v2
```

### Run

```bash
# Terminal 1 — Backend (port 8000)
cd backend && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (port 3000)
cd frontend && bun dev
```

## Opinion Dynamics

NPC social influence is based on models from:

> Peralta, A. F., Kertesz, J., and Iniguez, G. (2022). *Opinion dynamics in social networks: From models to data.* [arXiv:2201.01322](https://arxiv.org/abs/2201.01322)

This review paper surveys how individual opinions shift through social interaction, covering discrete models (voter model) and continuous models (Deffuant bounded confidence, DeGroot weighted averaging, Baumann polarization), validated against election data and controlled sociological experiments.

We implement three mechanisms from the paper:

- **Deffuant Bounded Confidence** — opinions converge only when close enough (`|x_i - x_j| < e`)
- **Baumann Controversy Amplification** — high-controversy policies push opinions toward extremes via `tanh(a * x)`
- **Keep/Compromise/Adopt** — behavioral classification based on relationship strength (strangers keep opinions, friends compromise, family adopts)

See [backend/README.md](backend/README.md) for the full equations and parameters.

## Project Structure

```
yhack/
+-- frontend/              # Next.js 16 + Phaser 3
|   +-- src/app/           # Pages and layouts
|   +-- src/components/    # GameCanvas, PolicyInput, EventFeed
|   +-- src/game/          # Phaser scenes and bridge
|   +-- biome.json         # Linting config
|
+-- backend/               # FastAPI + LangGraph
|   +-- main.py            # App entry point
|   +-- config.py          # Grid dims, settings
|   +-- models/            # Pydantic schemas, LangGraph state
|   +-- graph/             # LLM nodes, prompts, orchestrator
|   +-- routers/           # HTTP + WebSocket endpoints
|   +-- tests/             # pytest
|
+-- CLAUDE.md              # AI assistant instructions
+-- README.md              # This file
```
