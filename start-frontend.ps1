$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Frontend = Join-Path $Root "frontend"

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location $Frontend
    npm install
} else {
    Set-Location $Frontend
}

Write-Host "Starting frontend on http://localhost:5173" -ForegroundColor Green
Write-Host "Backend must be running: .\start-backend.ps1" -ForegroundColor DarkGray
Write-Host ""

npm run dev
