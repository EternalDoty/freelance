$ErrorActionPreference = 'Stop'

param(
  [switch]$PrepareOnly
)

$rootDir = Resolve-Path (Join-Path $PSScriptRoot '../..')
$runtimeDir = Join-Path $rootDir '.local-runtime'
$backendLog = Join-Path $runtimeDir 'backend.log'
$frontendLog = Join-Path $runtimeDir 'frontend.log'
$backendPidFile = Join-Path $runtimeDir 'backend.pid'
$frontendPidFile = Join-Path $runtimeDir 'frontend.pid'

function Write-Info($msg) {
  Write-Host "[local-test-run.ps1] $msg"
}

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command is missing: $name"
  }
}

function Ensure-EnvFiles {
  $backendEnv = Join-Path $rootDir 'backend/.env'
  if (-not (Test-Path $backendEnv)) {
    Copy-Item (Join-Path $rootDir 'backend/env.example') $backendEnv
    Write-Info 'Created backend/.env from backend/env.example'
  }

  $frontendEnv = Join-Path $rootDir 'frontend/.env.local'
  if (-not (Test-Path $frontendEnv)) {
    "VITE_API_URL=http://localhost:3000/api" | Set-Content -Path $frontendEnv -Encoding UTF8
    Write-Info 'Created frontend/.env.local'
  }
}

function Install-DependenciesIfNeeded {
  if (-not (Test-Path (Join-Path $rootDir 'backend/node_modules'))) {
    Write-Info 'Installing backend dependencies'
    Push-Location (Join-Path $rootDir 'backend')
    npm ci
    Pop-Location
  }

  if (-not (Test-Path (Join-Path $rootDir 'frontend/node_modules'))) {
    Write-Info 'Installing frontend dependencies'
    Push-Location (Join-Path $rootDir 'frontend')
    npm ci
    Pop-Location
  }
}

function Start-Dependencies {
  Write-Info 'Starting PostgreSQL and Redis via docker-compose.dev.yml'
  Push-Location $rootDir
  docker compose -f docker-compose.dev.yml up -d postgres redis
  Pop-Location
}

function Wait-Http($url, $serviceName, $maxAttempts = 45) {
  for ($i = 1; $i -le $maxAttempts; $i++) {
    try {
      $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      Write-Info "$serviceName is reachable: $url"
      return
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "Timeout while waiting for $serviceName: $url"
}

function Cleanup-StalePid($pidFile) {
  if (-not (Test-Path $pidFile)) {
    return
  }

  $oldPid = Get-Content $pidFile
  if ($oldPid) {
    $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Info "Stopping stale process with PID $oldPid"
      Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
    }
  }

  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

function Start-Apps {
  if (-not (Test-Path $runtimeDir)) {
    New-Item -ItemType Directory -Path $runtimeDir | Out-Null
  }

  Cleanup-StalePid $backendPidFile
  Cleanup-StalePid $frontendPidFile

  Write-Info 'Starting backend on http://localhost:3000'
  $backendProc = Start-Process -FilePath 'npm' -ArgumentList 'run','dev' -WorkingDirectory (Join-Path $rootDir 'backend') -RedirectStandardOutput $backendLog -RedirectStandardError $backendLog -PassThru
  $backendProc.Id | Set-Content -Path $backendPidFile -Encoding UTF8

  Write-Info 'Starting frontend on http://localhost:3001'
  $frontendProc = Start-Process -FilePath 'npm' -ArgumentList 'run','dev','--','--host','0.0.0.0','--port','3001' -WorkingDirectory (Join-Path $rootDir 'frontend') -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendLog -PassThru
  $frontendProc.Id | Set-Content -Path $frontendPidFile -Encoding UTF8

  Wait-Http 'http://localhost:3000/health' 'Backend'
  Wait-Http 'http://localhost:3001' 'Frontend'
}

Require-Command 'docker'
Require-Command 'npm'

if (-not (Test-Path $runtimeDir)) {
  New-Item -ItemType Directory -Path $runtimeDir | Out-Null
}

Ensure-EnvFiles
Install-DependenciesIfNeeded
Start-Dependencies

if ($PrepareOnly) {
  Write-Info 'Preparation finished (--PrepareOnly)'
  exit 0
}

Start-Apps

Write-Info 'Local test environment is ready'
Write-Host '- Frontend: http://localhost:3001'
Write-Host '- Backend:  http://localhost:3000'
Write-Host '- API docs: http://localhost:3000/api-docs'
Write-Host '- Stop script: .\deployment\scripts\local-test-stop.ps1'
