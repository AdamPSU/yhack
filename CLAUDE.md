# Agent Instructions

## Package Managers
- **Frontend**: Bun — `bun install`, `bun dev`, `bun build`
- **Backend**: uv — `uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000`

## File-Scoped Commands
| Task | Command |
|------|---------|
| Lint | `cd frontend && bun lint` |
| Format | `cd frontend && bun format` |
| Backend tests | `cd backend && uv run pytest` |

## Key Conventions
- **Phaser client-only**: wrap in `next/dynamic` with `ssr: false`; page must be `"use client"`
- **Linting**: Biome 2.2.0 — not ESLint. Rules live in `frontend/biome.json`
- **EventBridge**: singleton in `src/game/bridge/` bridges React ↔ Phaser via `sim:*` events
- **LLM model**: set via `MODEL_NAME` in backend `.env` (`grok-3-think-v2` or `k2-think-v2`)
- **Next.js 16**: has breaking changes — read `node_modules/next/dist/docs/` before using unfamiliar APIs

## Environment Variables
```
XAI_API_KEY=xai-...
K2_API_KEY=...
MODEL_NAME=grok-3-think-v2
```

## Project Layout
```
frontend/src/
  components/    # UI: ChatBubble, Dashboard, EventFeed, GameCanvas, NPCProfileModal, PolicyInput
  game/          # Phaser: scenes/, systems/, effects/, entities/, bridge/, map/
  hooks/         # useSimulation (WebSocket)
  services/      # wsClient
  types/         # index.ts (frontend types), backend.ts (backend types)
backend/
  graph/nodes/   # parse_policy, npc_orchestrator, run_round
  routers/       # simulate.py — POST /simulate + WebSocket /simulate/{id}/ws
```
