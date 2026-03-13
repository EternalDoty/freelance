#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.local-runtime"
BACKEND_LOG="$RUNTIME_DIR/backend.log"
FRONTEND_LOG="$RUNTIME_DIR/frontend.log"
BACKEND_TUNNEL_LOG="$RUNTIME_DIR/backend-tunnel.log"
FRONTEND_TUNNEL_LOG="$RUNTIME_DIR/frontend-tunnel.log"
BACKEND_PID_FILE="$RUNTIME_DIR/backend.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"
BACKEND_TUNNEL_PID_FILE="$RUNTIME_DIR/backend-tunnel.pid"
FRONTEND_TUNNEL_PID_FILE="$RUNTIME_DIR/frontend-tunnel.pid"
PREPARE_ONLY=false

if [[ "${1:-}" == "--prepare-only" ]]; then
  PREPARE_ONLY=true
fi

log() {
  echo "[ubuntu-cloudflared] $1"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is missing: $command_name" >&2
    exit 1
  fi
}

cleanup_stale_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local old_pid
    old_pid="$(cat "$pid_file")"
    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" >/dev/null 2>&1; then
      log "Stopping stale process with PID $old_pid"
      kill "$old_pid" || true
    fi
    rm -f "$pid_file"
  fi
}

wait_for_http() {
  local url="$1"
  local service_name="$2"
  local max_attempts=45

  for ((attempt=1; attempt<=max_attempts; attempt++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$service_name is reachable: $url"
      return 0
    fi
    sleep 1
  done

  echo "Timeout while waiting for $service_name: $url" >&2
  return 1
}

wait_for_tunnel_url() {
  local log_file="$1"
  local timeout_seconds="${2:-45}"
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if [[ -f "$log_file" ]]; then
      local tunnel_url
      tunnel_url="$(rg -o "https://[a-zA-Z0-9.-]+\.trycloudflare\.com" "$log_file" -m 1 2>/dev/null || true)"
      if [[ -n "$tunnel_url" ]]; then
        echo "$tunnel_url"
        return 0
      fi
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo "Could not extract tunnel URL from $log_file" >&2
  return 1
}

ensure_env_files() {
  if [[ ! -f "$ROOT_DIR/backend/.env" ]]; then
    cp "$ROOT_DIR/backend/env.example" "$ROOT_DIR/backend/.env"
    log "Created backend/.env from backend/env.example"
  fi

  if [[ ! -f "$ROOT_DIR/frontend/.env.local" ]]; then
    cat > "$ROOT_DIR/frontend/.env.local" <<'EOT'
VITE_API_URL=http://localhost:3000/api
EOT
    log "Created frontend/.env.local"
  fi
}

install_dependencies_if_needed() {
  if [[ ! -d "$ROOT_DIR/backend/node_modules" ]]; then
    log "Installing backend dependencies"
    (cd "$ROOT_DIR/backend" && npm ci)
  fi

  if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
    log "Installing frontend dependencies"
    (cd "$ROOT_DIR/frontend" && npm ci)
  fi
}

start_dependencies() {
  log "Starting PostgreSQL and Redis via docker-compose.dev.yml"
  (cd "$ROOT_DIR" && docker compose -f docker-compose.dev.yml up -d postgres redis)

  log "Waiting for PostgreSQL"
  (cd "$ROOT_DIR" && timeout 60 bash -c 'until docker compose -f docker-compose.dev.yml exec -T postgres pg_isready -U postgres -d freelance_platform >/dev/null 2>&1; do sleep 2; done')

  log "Waiting for Redis"
  (cd "$ROOT_DIR" && timeout 60 bash -c 'until docker compose -f docker-compose.dev.yml exec -T redis redis-cli ping | grep -q PONG; do sleep 2; done')
}

start_backend() {
  cleanup_stale_pid "$BACKEND_PID_FILE"
  cleanup_stale_pid "$BACKEND_TUNNEL_PID_FILE"

  log "Starting backend on http://localhost:3000"
  (
    cd "$ROOT_DIR/backend"
    nohup npm run dev > "$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
  )

  wait_for_http "http://localhost:3000/health" "Backend"

  log "Starting cloudflared tunnel for backend"
  nohup cloudflared tunnel --url http://localhost:3000 --no-autoupdate > "$BACKEND_TUNNEL_LOG" 2>&1 &
  echo $! > "$BACKEND_TUNNEL_PID_FILE"

  BACKEND_TUNNEL_URL="$(wait_for_tunnel_url "$BACKEND_TUNNEL_LOG")"
  log "Backend tunnel URL: $BACKEND_TUNNEL_URL"
}

start_frontend() {
  cleanup_stale_pid "$FRONTEND_PID_FILE"
  cleanup_stale_pid "$FRONTEND_TUNNEL_PID_FILE"

  cat > "$ROOT_DIR/frontend/.env.local" <<EOF2
VITE_API_URL=${BACKEND_TUNNEL_URL}/api
EOF2
  log "Updated frontend/.env.local with backend tunnel URL"

  log "Starting frontend on http://localhost:3001"
  (
    cd "$ROOT_DIR/frontend"
    nohup npm run dev -- --host 0.0.0.0 --port 3001 > "$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
  )

  wait_for_http "http://localhost:3001" "Frontend"

  log "Starting cloudflared tunnel for frontend"
  nohup cloudflared tunnel --url http://localhost:3001 --no-autoupdate > "$FRONTEND_TUNNEL_LOG" 2>&1 &
  echo $! > "$FRONTEND_TUNNEL_PID_FILE"

  FRONTEND_TUNNEL_URL="$(wait_for_tunnel_url "$FRONTEND_TUNNEL_LOG")"
  log "Frontend tunnel URL: $FRONTEND_TUNNEL_URL"
}

print_summary() {
  echo
  log "Project is ready for Ubuntu local testing"
  echo "- Frontend (local):  http://localhost:3001"
  echo "- Backend (local):   http://localhost:3000"
  echo "- Frontend (public): $FRONTEND_TUNNEL_URL"
  echo "- Backend (public):  $BACKEND_TUNNEL_URL"
  echo "- API docs:          $BACKEND_TUNNEL_URL/api-docs"
  echo "- Stop command:      ./deployment/scripts/stop-ubuntu-cloudflared.sh"
}

main() {
  require_command docker
  require_command npm
  require_command curl
  require_command cloudflared

  mkdir -p "$RUNTIME_DIR"

  ensure_env_files
  install_dependencies_if_needed
  start_dependencies

  if [[ "$PREPARE_ONLY" == "true" ]]; then
    log "Preparation finished (--prepare-only)"
    exit 0
  fi

  start_backend
  start_frontend
  print_summary
}

main "$@"
