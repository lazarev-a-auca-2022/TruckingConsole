@echo off
echo Testing Trucking Console API...

REM Test health endpoint
echo 1. Testing health endpoint...
curl -f http://localhost:3000/health

echo.
echo 2. Testing API info...
curl -f http://localhost:3000/api

echo.
echo 3. Testing PNG conversion with test route ID...
curl -f http://localhost:3000/api/convert-png/test_route_123 -o test_download.png

if exist test_download.png (
  echo ✅ PNG downloaded successfully
  dir test_download.png
) else (
  echo ❌ PNG download failed
)

echo.
echo 4. Testing file upload...
if exist sample-permits\image-2025-06-18-065225.png (
  curl -X POST -F "permit=@sample-permits/image-2025-06-18-065225.png" -F "state=IL" http://localhost:3000/api/parse
) else (
  echo Sample permit file not found
)
