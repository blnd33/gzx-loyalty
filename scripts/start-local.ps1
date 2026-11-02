param([switch]$NoBrowser,[switch]$LocalOnly)
$ErrorActionPreference='Stop'
$projectPath=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectPath
$nodePath=(Get-Command node -ErrorAction Stop).Source
if ([int]((& $nodePath -p 'parseInt(process.versions.node)')) -lt 24) { throw 'Install Node.js 24 LTS or newer, then run Start Lounge again.' }
if (-not (Test-Path -LiteralPath 'node_modules/next')) { & npm.cmd ci --no-audit --no-fund; if($LASTEXITCODE -ne 0){throw 'Dependency installation failed.'} }
$loungeAddress='localhost'
if(-not $LocalOnly){
  $route=Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
  if($route){$address=Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -AddressState Preferred -ErrorAction SilentlyContinue | Where-Object {$_.IPAddress -notlike '169.254.*' -and $_.IPAddress -ne '127.0.0.1'} | Select-Object -First 1;if($address){$loungeAddress=$address.IPAddress}}
  if($loungeAddress -eq 'localhost'){throw 'Connect this computer to the lounge Wi-Fi, then start again. Use -LocalOnly for a computer-only session.'}
}
$loungeUrl='http://'+$loungeAddress+':3000'
$env:DATABASE_PROVIDER='local'
$env:DEPLOYMENT_MODE='lan'
$env:APP_URL=$loungeUrl
$env:LOCAL_DB_PATH=Join-Path $projectPath 'data/lounge.sqlite'
$env:BACKUP_DIR=Join-Path $projectPath 'backups'
Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
& $nodePath --experimental-strip-types scripts/local-init.mjs
if($LASTEXITCODE -ne 0){throw 'Database initialization failed.'}
$running=$false
try { $health=Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 3; $running=$health.app -eq 'gzx-loyalty-local' } catch {}
if($running -and (Test-Path -LiteralPath 'data/server-process.json')){
  $saved=Get-Content -LiteralPath 'data/server-process.json' -Raw | ConvertFrom-Json
  if($saved.url -ne $loungeUrl){& (Join-Path $PSScriptRoot 'stop-local.ps1');$running=$false}
}
if (-not $running) {
  if (-not (Test-Path -LiteralPath '.next/BUILD_ID')) { & npm.cmd run build; if($LASTEXITCODE -ne 0){throw 'App build failed.'} }
  & $nodePath --experimental-strip-types scripts/local-backup.mjs
  if($LASTEXITCODE -ne 0){throw 'Backup failed; app was not started.'}
  $bindAddress=if($LocalOnly){'127.0.0.1'}else{'0.0.0.0'}
  $serverProcess=Start-Process -FilePath $nodePath -ArgumentList @('node_modules/next/dist/bin/next','start','--hostname',$bindAddress,'--port','3000') -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput 'data/server.log' -RedirectStandardError 'data/server-errors.log' -PassThru
  @{pid=$serverProcess.Id;startedTicks=$serverProcess.StartTime.ToUniversalTime().Ticks.ToString();url=$loungeUrl;mode='local-sqlite'} | ConvertTo-Json | Set-Content -LiteralPath 'data/server-process.json'
  for ($attempt=0;$attempt -lt 30;$attempt++) {
    try { $health=Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health' -TimeoutSec 2; if($health.app -eq 'gzx-loyalty-local'){$running=$true;break} } catch {}
    Start-Sleep -Seconds 1
  }
  if(-not $running){throw 'The app did not start. Check data/server-errors.log. Port 3000 may already be in use.'}
}
Set-Content -LiteralPath 'data/LAN-ADDRESS.txt' -Value $loungeUrl
Write-Host ('GZX Lounge is running at '+$loungeUrl+' - use this address on lounge Wi-Fi.')
if(-not $NoBrowser){Start-Process $loungeUrl}
