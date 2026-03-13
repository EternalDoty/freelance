#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.local-runtime"

stop_by_pid_file() {
  local pid_file="$1"
  local name="$2"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" || true
      echo "[stop-ubuntu-cloudflared] Stopped $name (PID $pid)"
    else
      echo "[stop-ubuntu-cloudflared] $name already stopped"
    fi
    rm -f "$pid_file"
  else
    echo "[stop-ubuntu-cloudflared] PID file not found for $name"
  fi
}

stop_by_pid_file "$RUNTIME_DIR/frontend-tunnel.pid" "frontend tunnel"
stop_by_pid_file "$RUNTIME_DIR/backend-tunnel.pid" "backend tunnel"
stop_by_pid_file "$RUNTIME_DIR/frontend.pid" "frontend"
stop_by_pid_file "$RUNTIME_DIR/backend.pid" "backend"

(cd "$ROOT_DIR" && docker compose -f docker-compose.dev.yml down)

echo "[stop-ubuntu-cloudflared] Docker dependencies stopped"
