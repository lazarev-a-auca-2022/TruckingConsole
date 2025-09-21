@echo off
echo 🚛 Trucking Console App - Docker Deployment
echo ===========================================

REM Build and start the application
echo Building Docker image...
docker-compose build

echo Starting application...
docker-compose up -d

echo Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check if services are running
echo Checking service status...
docker-compose ps

REM Test the health endpoint
echo Testing application health...
curl -f http://localhost:3000/health

echo.
echo 🎉 Deployment complete!
echo.
echo Application is running at: http://localhost:3000
echo API documentation: http://localhost:3000
echo.
echo Test the API with:
echo curl -X POST -F "permit=@sample-permits/image-2025-06-18-065225.png" -F "state=IL" http://localhost:3000/api/parse
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
