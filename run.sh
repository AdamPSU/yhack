#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down…"
  # Kill the process group first
  kill 0 2>/dev/null
  # Then force-kill anything still holding our ports
  for port in 3000 8000; do
    pids=$(lsof -ti :"$port" 2>/dev/null) || true
    if [ -n "$pids" ]; then
      echo "Killing leftover processes on :$port (PIDs: $pids)"
      echo "$pids" | xargs kill -9 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM HUP

echo "Starting backend on :8000 …"
(cd "$ROOT/backend" && uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000) &

echo "Starting frontend on :3000 …"
(cd "$ROOT/frontend" && bun dev)
