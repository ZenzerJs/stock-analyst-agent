$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Python = Join-Path $Root "venv\Scripts\python.exe"
$Backend = Join-Path $Root "backend"
$EnvFile = Join-Path $Backend ".env"

if (-not (Test-Path $Python)) {
    Write-Host "ERROR: venv not found at $Python" -ForegroundColor Red
    Write-Host ""
    Write-Host "Create it once:" -ForegroundColor Yellow
    Write-Host "  cd $Root"
    Write-Host "  python -m venv venv"
    Write-Host "  .\venv\Scripts\pip install -r backend\requirements.txt"
    exit 1
}

if (-not (Test-Path $EnvFile)) {
    Write-Host "ERROR: Missing backend\.env" -ForegroundColor Red
    Write-Host "Copy backend\.env.example to backend\.env and add your API keys."
    exit 1
}

$envContent = Get-Content $EnvFile -Raw
if ($envContent -notmatch "GROQ_API_KEY=") {
    Write-Host "WARN: backend\.env missing GROQ_API_KEY line (OK for BYOK shell)" -ForegroundColor Yellow
}

Write-Host "Starting backend on http://localhost:8000" -ForegroundColor Green
Write-Host "Swagger docs: http://localhost:8000/docs" -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

Set-Location $Backend
& $Python -m uvicorn app.main:app_fastapi --host 127.0.0.1 --port 8000 --reload
