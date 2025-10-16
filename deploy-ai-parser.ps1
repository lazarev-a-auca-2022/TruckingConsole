# AI Parser Deployment Script for Windows
# Run this to deploy the AI-powered parser to your Docker container

Write-Host "🤖 AI-Powered Permit Parser - Deployment Script" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "1️⃣  Checking Docker..." -ForegroundColor Yellow
try {
    $dockerCheck = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed or not accessible" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2️⃣  Stopping current containers..." -ForegroundColor Yellow
docker-compose down
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Containers stopped" -ForegroundColor Green
} else {
    Write-Host "⚠️  Warning: Could not stop containers (may not be running)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "3️⃣  Building new image with AI parser..." -ForegroundColor Yellow
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build completed" -ForegroundColor Green

Write-Host ""
Write-Host "4️⃣  Starting containers..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start containers!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Containers started" -ForegroundColor Green

Write-Host ""
Write-Host "5️⃣  Waiting for application to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "6️⃣  Checking application logs..." -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Gray
docker-compose logs --tail=20 app
Write-Host "=" * 60 -ForegroundColor Gray

Write-Host ""
Write-Host "7️⃣  Verifying AI Parser configuration..." -ForegroundColor Yellow
$envCheck = docker-compose exec -T app env | Select-String "AI_MODEL"
if ($envCheck) {
    Write-Host "✅ AI_MODEL: $envCheck" -ForegroundColor Green
} else {
    Write-Host "⚠️  AI_MODEL not found (will use default)" -ForegroundColor Yellow
}

$apiKeyCheck = docker-compose exec -T app env | Select-String "OPENROUTER_API_KEY" | Select-String -Pattern "sk-or-v1-"
if ($apiKeyCheck) {
    Write-Host "✅ OPENROUTER_API_KEY is set" -ForegroundColor Green
} else {
    Write-Host "❌ OPENROUTER_API_KEY not found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 What changed:" -ForegroundColor Cyan
Write-Host "  • Added AI-powered parser using Claude Sonnet 3.5" -ForegroundColor White
Write-Host "  • PDF text is now parsed by AI instead of regex" -ForegroundColor White
Write-Host "  • Should extract 10+ waypoints from Virginia permits" -ForegroundColor White
Write-Host ""
Write-Host "🧪 Test it:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:3000" -ForegroundColor White
Write-Host "  2. Upload your Virginia EZ-HAUL PDF" -ForegroundColor White
Write-Host "  3. Check waypoints - should see 10+ instead of 0!" -ForegroundColor White
Write-Host ""
Write-Host "📊 Monitor logs:" -ForegroundColor Cyan
Write-Host "  docker-compose logs -f app" -ForegroundColor White
Write-Host ""
Write-Host "🔍 Look for:" -ForegroundColor Cyan
Write-Host "  'AI Parser initialized with model: anthropic/claude-3.5-sonnet'" -ForegroundColor White
Write-Host "  'Using AI-powered parsing (Claude Sonnet 4)...'" -ForegroundColor White
Write-Host "  '✅ AI parsing successful with XX% confidence'" -ForegroundColor White
Write-Host ""

# Ask if user wants to see live logs
Write-Host "Would you like to view live logs? (Y/N): " -NoNewline -ForegroundColor Yellow
$response = Read-Host
if ($response -eq "Y" -or $response -eq "y") {
    Write-Host ""
    Write-Host "📜 Live logs (Ctrl+C to exit):" -ForegroundColor Cyan
    docker-compose logs -f app
}
