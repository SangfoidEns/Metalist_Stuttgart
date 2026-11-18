# MetaList Stuttgart — Windows companion server
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '[ERROR] Node.js 18+ is required. Install from https://nodejs.org/' -ForegroundColor Red
  exit 1
}

if (-not $env:PORT) { $env:PORT = '8787' }
if (-not $env:OPEN_UI) { $env:OPEN_UI = '1' }

Write-Host ''
Write-Host ' METALIST STUTTGART — Windows companion server' -ForegroundColor Cyan
Write-Host " Port: $($env:PORT)"
Write-Host " Panel: http://127.0.0.1:$($env:PORT)/"
Write-Host ''

node "$PSScriptRoot\src\main.mjs"
