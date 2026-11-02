param([switch]$NoBrowser)
$ErrorActionPreference='Stop'
$projectPath=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectPath
$nodePath=(Get-Command node -ErrorAction Stop).Source
if ([int]((& $nodePath -p 'parseInt(process.versions.node)')) -lt 24) { throw 'Install Node.js 24 LTS or newer, then run Start Lounge again.' }
if (-not (Test-Path -LiteralPath 'node_modules/next')) { & npm.cmd ci --no-audit --no-fund; if($LASTEXITCODE -ne 0){throw 'Dependency installation failed.'} }
& $nodePath --experimental-strip-types scripts/local-init.mjs
if($LASTEXITCODE -ne 0){throw 'Database initialization failed.'}
$running=$false
try { $health=Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 3; $running=$health.app -eq 'gzx-loyalty-local' } catch {}
if (-not $running) {
  if (-not (Test-Path -LiteralPath '.next/BUILD_ID')) { & npm.cmd run build; if($LASTEXITCODE -ne 0){throw 'App build failed.'} }
  & $nodePath --experimental-strip-types scripts/local-backup.mjs
  if($LASTEXITCODE -ne 0){throw 'Backup failed; app was not started.'}
  $serverProcess=Start-Process -FilePath $nodePath -ArgumentList @('node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput 'data/server.log' -RedirectStandardError 'data/server-errors.log' -PassThru
  @{pid=$serverProcess.Id;startedTicks=$serverProcess.StartTime.ToUniversalTime().Ticks.ToString()} | ConvertTo-Json | Set-Content -LiteralPath 'data/server-process.json'
  for ($attempt=0;$attempt -lt 30;$attempt++) {
    try { $health=Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 2; if($health.app -eq 'gzx-loyalty-local'){$running=$true;break} } catch {}
    Start-Sleep -Seconds 1
  }
  if(-not $running){throw 'The app did not start. Check data/server-errors.log. Port 3000 may already be in use.'}
}
Write-Host 'GZX Lounge is running at http://localhost:3000'
if(-not $NoBrowser){Start-Process 'http://localhost:3000'}
