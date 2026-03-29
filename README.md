# PolicySim

Simulate how economic policies cascade to everyday life. Input ~500 words of policy text, and 25 LLM-powered NPC agents react in real time — protesting, adjusting prices, shifting opinions — visualized in a pixel-art world.

Built at YHack 2026.

## How It Works

1. You paste a policy (e.g. "Raise minimum wage to $20/hr")
2. An LLM analyzes affected sectors, stakeholders, and controversy level
3. 25 diverse NPC personas are generated — workers, shopkeepers, politicians, farmers
4. Over 5 simulation rounds, each NPC perceives the policy, retrieves relevant memories, reflects, updates its plan, and acts
5. NPCs influence each other through proximity-based social dynamics grounded in [opinion dynamics research](https://arxiv.org/abs/2201.01322)
6. Everything streams live to a pixel-art frontend via WebSocket
7. Click any event in the feed to inspect that NPC's full profile — mood, income, political leaning, internal thoughts, feelings, and current plan

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
                            +-- loop N rounds <--------+
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

## Generative Agent Architecture

NPC cognitive architecture is based on:

> Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). *Generative Agents: Interactive Simulacra of Human Behavior.* [arXiv:2304.03442](https://arxiv.org/abs/2304.03442)

This paper introduces a cognitive architecture for LLM-powered agents that produces believable, emergent behavior in a sandbox environment. The core contribution is three mechanisms that give agents long-term coherence: a memory stream for recording experiences, a retrieval system for surfacing relevant memories, and a reflection process for synthesizing higher-level insights.

We adapt three core mechanisms from the paper to our policy simulation:

### Memory Stream (Paper Section 3.1)

Each NPC maintains an append-only log of everything it experiences: observations (what it perceives and does each round), reflections (synthesized insights), and plans (intended actions across rounds). Each memory is scored with an importance value (1-10) assigned heuristically by event type.

**Adaptation**: The paper uses LLM calls to score importance for each memory. We use a heuristic mapping (protests = 8, price changes = 7, chat = 5, movement = 2) to avoid 25+ extra LLM calls per round while maintaining meaningful differentiation.

### Memory Retrieval (Paper Section 3.1, Eq. scoring)

When an NPC needs to act, we retrieve the top-K most relevant memories using a three-factor scoring formula from the paper:

```
score(memory) = recency × importance × relevance
```

- **Recency**: Exponential decay `0.8^(rounds_since_last_access)` — the paper uses 0.995 per game-hour; our coarser rounds use a steeper decay
- **Importance**: Normalized to [0, 1] from the 1-10 heuristic score
- **Relevance**: Jaccard keyword similarity between the current context and the memory description — the paper uses embedding cosine similarity; we use keyword overlap to avoid an embedding model dependency

This replaces the previous approach of only showing last round's neighbor events, giving NPCs access to their full history with intelligent prioritization.

### Reflection (Paper Section 3.3)

Periodically, NPCs synthesize higher-level insights from their accumulated observations. Reflection is triggered when the sum of importance scores for recent memories exceeds a threshold (25, adapted from the paper's 150 for multi-day simulations). When triggered, the NPC generates 2-3 insights that are stored back in the memory stream and participate in future retrieval.

**Adaptation**: The paper triggers reflection ~2-3 times per simulated day across multi-day runs. Our threshold of 25 means NPCs typically reflect every 1-2 rounds, appropriate for a 5-round simulation. We cap concurrent reflections at 5 per round to control LLM costs.

### Planning (Paper Section 3.4, simplified)

NPCs form an initial plan after perceiving the policy and can revise it when unexpected events occur. Plans are stored in the memory stream and always included in the NPC's prompt context.

**Adaptation**: The paper uses a 3-level hierarchical planning system (day → hour → 5-15 min chunks) for its multi-day sandbox. Our rounds are the atomic unit, so we use single-sentence plans that describe intended behavior across the remaining simulation.

### What We Didn't Take

- **Environment tree traversal**: The paper represents the world as a tree (world → areas → objects) and uses LLM calls to navigate it. Our grid-based simulation with simple tile movement doesn't need this.
- **Multi-turn dialogue**: The paper generates turn-by-turn conversations between agents. We use single-round chat events for simplicity.
- **Embedding-based relevance**: We use Jaccard keyword similarity instead of embedding cosine similarity to avoid adding an embedding model dependency.
- **LLM-scored importance**: We use event-type heuristics instead of per-memory LLM importance scoring to control costs.

## Project Structure

```
yhack/
+-- frontend/              # Next.js 16 + Phaser 3
|   +-- src/app/           # Pages and layouts
|   +-- src/components/    # GameCanvas, PolicyInput, EventFeed, NPCProfileModal
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
