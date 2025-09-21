# Testing Guide for Trucking Console App

## Quick Start with Docker

1. **Deploy the application:**
   ```bash
   # On Windows
   deploy.bat
   
   # On Linux/Mac
   ./deploy.sh
   ```

2. **Wait for services to start** (about 30 seconds)

3. **Test with sample permit images:**

## Testing with Sample Images

### Using curl (Command Line)

Test a single image:
```bash
curl -X POST \
  -F "permit=@sample-permits/image-2025-06-18-065225.png" \
  -F "state=IL" \
  http://localhost:3000/api/parse
```

### Using Console Commands (inside Docker)

Parse a single image:
```bash
docker-compose exec app node src/index.js parse \
  --file sample-permits/image-2025-06-18-065225.png \
  --state IL
```

Batch process all sample images:
```bash
docker-compose exec app node src/index.js batch \
  --directory sample-permits \
  --state IL
```

## Expected Results

The application will:
1. Process the PNG image using OCR (Tesseract.js)
2. Extract text from the permit
3. Parse route information using Illinois-specific patterns
4. Return structured data including:
   - Route ID
   - Start/end points
   - Waypoints
   - Restrictions
   - Distance information
   - Parse accuracy score

## Sample Response Format

```json
{
  "success": true,
  "data": {
    "routeId": "route_1695301234567_abc123def",
    "state": "IL",
    "fileType": "png",
    "parseResult": {
      "startPoint": {
        "address": "Chicago, IL",
        "description": "Start point"
      },
      "endPoint": {
        "address": "Springfield, IL", 
        "description": "End point"
      },
      "waypoints": [],
      "restrictions": [],
      "parseAccuracy": 0.8
    },
    "timestamp": "2025-09-21T12:00:00.000Z",
    "filePath": "image-2025-06-18-065225.png"
  }
}
```

## Troubleshooting

1. **OCR taking too long:** The first OCR operation downloads Tesseract models (~50MB). Subsequent operations are faster.

2. **Low parse accuracy:** This is normal for the MVP. The parsers use basic regex patterns and can be improved with more training data.

3. **No text extracted:** Check image quality. Preprocessed images are saved to `/app/temp/` for debugging.

## API Endpoints

- `GET /` - API information
- `GET /health` - Health check
- `POST /api/parse` - Parse permit file
- `GET /api/maps-url/:routeId` - Get Google Maps URL
- `GET /api/gpx/:routeId` - Download GPX file

## Logs

View real-time logs:
```bash
docker-compose logs -f app
```

View OCR processing logs:
```bash
docker-compose logs -f app | grep OCR
```
