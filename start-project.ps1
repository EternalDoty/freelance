$ErrorActionPreference = 'Stop'

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeFile = Join-Path $rootDir 'deployment/docker-compose.yml'
$envFile = Join-Path $rootDir 'deployment/.env'

function Write-Info($msg) {
  Write-Host "[start-project.ps1] $msg"
}

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command is missing: $name"
  }
}

function Ensure-EnvFile {
  if (Test-Path $envFile) {
    return
  }

  @"
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
"@ | Set-Content -Path $envFile -Encoding UTF8

  Write-Info 'Created deployment/.env with local defaults'
}

Require-Command 'docker'
Ensure-EnvFile

Write-Info 'Building and starting full project stack'
& docker compose --env-file $envFile -f $composeFile up -d --build

Write-Info 'Current service status'
& docker compose --env-file $envFile -f $composeFile ps

Write-Host ''
Write-Info 'Project started'
Write-Host '- Frontend:   http://localhost:3001'
Write-Host '- Backend:    http://localhost:3000'
Write-Host '- Swagger:    http://localhost:3000/api-docs'
Write-Host '- Prometheus: http://localhost:9090'
Write-Host '- Grafana:    http://localhost:3002'
Write-Host ''
Write-Host 'To stop everything:'
Write-Host 'docker compose --env-file deployment/.env -f deployment/docker-compose.yml down'
