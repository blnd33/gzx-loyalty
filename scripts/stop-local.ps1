$ErrorActionPreference='Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
if(-not (Test-Path -LiteralPath 'data/server-process.json')){Write-Host 'No lounge server started by this launcher was found.';exit 0}
$savedProcess=Get-Content -LiteralPath 'data/server-process.json' -Raw | ConvertFrom-Json
$serverProcess=Get-Process -Id ([int]$savedProcess.pid) -ErrorAction SilentlyContinue
if($serverProcess -and $serverProcess.ProcessName -eq 'node' -and $serverProcess.StartTime.ToUniversalTime().Ticks.ToString() -eq $savedProcess.startedTicks){
  Stop-Process -InputObject $serverProcess
  Write-Host 'The lounge server has stopped. Saved data is kept.'
}else{Write-Host 'The lounge server is already stopped.'}
