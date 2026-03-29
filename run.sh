#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() { kill 0 2>/dev/null; }
trap cleanup EXIT INT TERM

echo "Starting backend on :8000 …"
(cd "$ROOT/backend" && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000) &

echo "Starting frontend on :3000 …"
(cd "$ROOT/frontend" && bun dev)
