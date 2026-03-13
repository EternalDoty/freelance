$ErrorActionPreference = 'Stop'

$rootDir = Resolve-Path (Join-Path $PSScriptRoot '../..')
$runtimeDir = Join-Path $rootDir '.local-runtime'
$backendPidFile = Join-Path $runtimeDir 'backend.pid'
$frontendPidFile = Join-Path $runtimeDir 'frontend.pid'

function Stop-ByPidFile($pidFile, $name) {
  if (-not (Test-Path $pidFile)) {
    Write-Host "[local-test-stop.ps1] PID file not found for $name"
    return
  }

  $pid = Get-Content $pidFile
  if ($pid) {
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) {
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      Write-Host "[local-test-stop.ps1] Stopped $name (PID $pid)"
    } else {
      Write-Host "[local-test-stop.ps1] $name already stopped"
    }
  }

  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Stop-ByPidFile $backendPidFile 'backend'
Stop-ByPidFile $frontendPidFile 'frontend'

Push-Location $rootDir
docker compose -f docker-compose.dev.yml down
Pop-Location

Write-Host '[local-test-stop.ps1] Docker dependencies stopped'
