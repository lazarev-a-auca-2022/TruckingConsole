# TruckingConsole - AI-Powered Permit Parser

Multi-state truck permit parser with AI vision capabilities for extracting routes from PDFs and images.

## Features

<<<<<<< HEAD
- **Web Interface**: Simple file upload with drag-and-drop support
- **OCR Processing**: Extract text from PNG, JPG, JPEG, GIF, BMP, TIFF, WEBP images
- **PDF Support**: Parse PDF permit files from multiple states
- **Route Verification**: NEW! Double-check waypoint extraction with verification workflow
- **Coordinate-Based Routing**: Uses GPS coordinates (lat/lng) instead of street addresses
- **PNG Conversion**: Generate standardized converted PNG permits
- **Route Export**: Export routes as GPX files for Garmin devices
- **Google Maps Integration**: Generate Google Maps URLs for navigation with coordinates
- **Console Interface**: Command-line tools for batch processing
- **Docker Deployment**: Ready for remote server deployment
=======
- **AI Vision Parsing**: Uses free Llama 3.2 Vision models to read routing tables from PDFs
- **Multi-State Support**: IL, WI, MO, ND, IN, VA, TX
- **Auto PDF→Image**: Converts PDFs to images for vision AI processing
- **GPX Export**: Generates routes for navigation apps
- **MongoDB Storage**: Caches parsed routes
>>>>>>> 5cec4040c9f63220e0bb3644da770684c70f0008

## Quick Deploy (Linux Server)

```bash
# Clone and navigate
cd /path/to/TruckingConsole

# Configure environment (edit docker-compose.yml with your OpenRouter API key)
nano docker-compose.yml

# Build and start
docker-compose up -d

# Verify
docker-compose logs -f app
```

Access: `http://your-server:3000`

## Configuration

**Important:** You need an OpenRouter API key with credits, even for free models.

1. Sign up at https://openrouter.ai
2. Add credits ($5 minimum): https://openrouter.ai/credits
3. Get your API key: https://openrouter.ai/keys

Edit `docker-compose.yml`:

```yaml
environment:
  - OPENROUTER_API_KEY=sk-or-v1-your-key-here  # Replace with your key
  - AI_MODEL=meta-llama/llama-3.2-90b-vision-instruct:free  # Best accuracy
  - USE_AI_PARSER=true
```

2. Run the container:
```bash
npm run docker:run
```

## Usage

### Web Interface

## How It Works

```
PDF Upload → Convert to Images → AI Vision Extraction → Parse Routing Table → Extract Waypoints
```

**Why AI Vision?**
- PDFs lose table structure during text extraction
- Vision AI reads routing tables visually
- Understands columns: Miles | Route | To | Distance

## API Endpoints

```bash
# Upload and parse permit
curl -X POST http://localhost:3000/upload \
  -F "permit=@virginia-permit.pdf" \
  -F "state=VA"

# Generate GPX route
curl http://localhost:3000/route/{routeId}/gpx > route.gpx

# Get all routes
curl http://localhost:3000/routes
```

## Troubleshooting

**HTTP 402 - Payment Required:**
```bash
# Your OpenRouter API key needs credits
# Add credits at: https://openrouter.ai/credits
# Even "free" models require an account with credits loaded
```

**0 waypoints extracted:**
```bash
# Check if AI vision is working
docker-compose logs app | grep "AI Parser initialized"
docker-compose logs app | grep "Converting PDF"

# Verify API key
docker exec $(docker ps -q -f name=app) env | grep OPENROUTER
```

**PDF conversion fails:**
```bash
# Check ImageMagick installed
docker exec $(docker ps -q -f name=app) which convert
```

<<<<<<< HEAD
### Required
- `OPENROUTER_API_KEY` - **Required** for image OCR and route verification

### Optional
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `GOOGLE_MAPS_API_KEY` - Google Maps API key (recommended for accurate geocoding)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)
=======
**Rate limits (free tier):**
- Limit: ~10-20 requests/minute
- Solution: Wait 60s between requests

## Tech Stack

- **Backend**: Node.js, Express
- **Database**: MongoDB
- **AI**: OpenRouter (Llama 3.2 Vision, free tier)
- **PDF Processing**: pdf-to-png-converter, ImageMagick
- **Deployment**: Docker, docker-compose
>>>>>>> 5cec4040c9f63220e0bb3644da770684c70f0008

## File Structure

```
src/
├── services/
│   ├── aiPermitParser.js      # AI vision parsing (LLM-powered)
│   ├── permitParser.js         # PDF→Image conversion + routing
│   ├── openRouterOcr.js        # Vision OCR API calls
│   ├── mapsService.js          # Google Maps integration
│   └── gpxService.js           # GPX file generation
├── models/
│   └── Route.js                # MongoDB schema
├── utils/
│   └── logger.js               # Winston logger
└── config/
    └── database.js             # MongoDB connection
tests/
└── *.test.js                   # Jest tests
```

## License

<<<<<<< HEAD
The application includes a Dockerfile for easy deployment on remote servers.

## Route Verification Workflow (NEW!)

For image permits (PNG, JPG, etc.), the system now uses a 4-step verification process:

1. **Extract Waypoints** - LLM reads permit image and extracts all route points
2. **Verify Waypoints** - LLM re-reads image to double-check extracted waypoints
3. **Geocode to Coordinates** - Converts addresses to GPS coordinates (lat/lng)
4. **Generate Maps JSON** - Creates Google Maps compatible JSON with coordinates

See [ROUTE_VERIFICATION.md](ROUTE_VERIFICATION.md) for detailed documentation.

### Test Route Verification

```bash
node test-route-verification.js
```

## Testing

Run tests:
```bash
npm test
```

Test route verification workflow:
```bash
node test-route-verification.js
```
=======
MIT
>>>>>>> 5cec4040c9f63220e0bb3644da770684c70f0008
