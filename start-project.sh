#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/deployment/docker-compose.yml"
ENV_FILE="$ROOT_DIR/deployment/.env"

log() {
  echo "[start-project] $1"
}

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command is missing: $command_name" >&2
    exit 1
  fi
}

ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return
  fi

  cat > "$ENV_FILE" <<'EOT'
NODE_ENV=development
DB_NAME=freelance_platform
DB_USER=postgres
DB_PASSWORD=password
REDIS_PASSWORD=
JWT_SECRET=local-dev-jwt-secret-change-me
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@freelance-platform.com
OPENAI_API_KEY=
AI_CONFIDENCE_THRESHOLD=0.7
AI_MAX_TOKENS=1000
CORS_ORIGIN=http://localhost:3001
CORS_CREDENTIALS=true
LOG_LEVEL=info
GRAFANA_PASSWORD=admin
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=B2C Freelance Platform
VITE_APP_VERSION=1.0.0
EOT

  log "Created deployment/.env with local defaults"
}

main() {
  require_command docker

  ensure_env_file

  log "Building and starting full project stack"
  docker compose \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    up -d --build

  log "Current service status"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

  echo
  log "Project started"
  echo "- Frontend:   http://localhost:3001"
  echo "- Backend:    http://localhost:3000"
  echo "- Swagger:    http://localhost:3000/api-docs"
  echo "- Prometheus: http://localhost:9090"
  echo "- Grafana:    http://localhost:3002"
  echo
  echo "To stop everything:"
  echo "docker compose --env-file deployment/.env -f deployment/docker-compose.yml down"
}

main "$@"
