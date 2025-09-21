# Quick Test Commands

## Rebuild and test the container:
```bash
# Stop current container
docker-compose down

# Rebuild with new changes
docker-compose up --build -d

# Wait a moment for startup
sleep 5

# Test the container PNG generation
docker-compose exec app node container-test.js

# Test the API endpoints
curl http://localhost:3000/api/test-png -o test-endpoint.png

# Check if the PNG is valid
file test-endpoint.png
```

## View detailed logs:
```bash
docker-compose logs -f app
```

## Test specific route download:
```bash
curl "http://localhost:3000/api/convert-png/route_1758458400428_g7f4rb2v4" -o route-download.png
```

## Debug inside container:
```bash
docker-compose exec app node container-test.js
docker-compose exec app node debug-png.js  
```

The PNG files should now be:
- Different colors for different states
- Valid PNG format (not blank/black)
- Downloadable through the web interface
