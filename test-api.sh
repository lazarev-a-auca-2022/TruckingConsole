#!/bin/bash

echo "Testing Trucking Console API..."

# Test health endpoint
echo "1. Testing health endpoint..."
curl -f http://localhost:3000/health || echo "Health check failed"

echo -e "\n2. Testing API info..."
curl -f http://localhost:3000/api || echo "API info failed"

echo -e "\n3. Testing PNG conversion with test route ID..."
curl -f http://localhost:3000/api/convert-png/test_route_123 \
  -o test_download.png \
  || echo "PNG download failed"

if [ -f test_download.png ]; then
  echo "✅ PNG downloaded successfully ($(wc -c < test_download.png) bytes)"
  file test_download.png
else
  echo "❌ PNG download failed"
fi

echo -e "\n4. Testing file upload..."
if [ -f sample-permits/image-2025-06-18-065225.png ]; then
  curl -X POST \
    -F "permit=@sample-permits/image-2025-06-18-065225.png" \
    -F "state=IL" \
    http://localhost:3000/api/parse \
    || echo "File upload test failed"
else
  echo "Sample permit file not found"
fi
