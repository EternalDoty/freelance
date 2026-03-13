#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.local-runtime"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"

stop_by_pid_file() {
  local pid_file="$1"
  local name="$2"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" || true
      echo "[local-test-stop] Stopped $name (PID $pid)"
    else
      echo "[local-test-stop] $name already stopped"
    fi
    rm -f "$pid_file"
  else
    echo "[local-test-stop] PID file not found for $name"
  fi
}

stop_by_pid_file "$BACKEND_PID_FILE" "backend"
stop_by_pid_file "$FRONTEND_PID_FILE" "frontend"

(cd "$ROOT_DIR" && docker compose -f docker-compose.dev.yml down)

echo "[local-test-stop] Docker dependencies stopped"
