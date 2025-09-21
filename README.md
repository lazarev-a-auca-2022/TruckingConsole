# Trucking Console App

A console-only application for parsing truck permit PDF files and converting them into navigable routes.

## Features

- **Web Interface**: Simple file upload with drag-and-drop support
- **OCR Processing**: Extract text from PNG, JPG, JPEG, GIF, BMP, TIFF, WEBP images
- **PDF Support**: Parse PDF permit files from multiple states
- **PNG Conversion**: Generate standardized converted PNG permits
- **Route Export**: Export routes as GPX files for Garmin devices
- **Google Maps Integration**: Generate Google Maps URLs for navigation
- **Console Interface**: Command-line tools for batch processing
- **Docker Deployment**: Ready for remote server deployment

## Supported States

- Illinois
- Wisconsin
- Missouri
- North Dakota
- Indiana

## Installation

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`

4. Run the application:
```bash
npm start
```

### Docker Deployment

1. Build the Docker image:
```bash
npm run docker:build
```

2. Run the container:
```bash
npm run docker:run
```

## Usage

### Web Interface

1. Open http://localhost:3000 in your browser
2. Select a state from the dropdown
3. Upload a permit file (PNG, JPG, or PDF)
4. Click "Process Permit"
5. Download the converted PNG or GPX file

### Command Line Interface

Parse a single PDF or image file:
```bash
node src/index.js parse --file path/to/permit.pdf --state IL
# or
node src/index.js parse --file path/to/permit.png --state IL
```

Batch process multiple files:
```bash
node src/index.js batch --directory path/to/permits --state IL
```

Start web server mode:
```bash
node src/index.js server --port 3000
```

### API Endpoints (Server Mode)

- `GET /` - Web interface
- `POST /api/parse` - Upload and parse permit file (PDF or image)
- `GET /api/routes/:id` - Get parsed route details
- `GET /api/maps-url/:id` - Get Google Maps URL
- `GET /api/gpx/:id` - Download GPX file
- `GET /api/convert-png/:id` - Download converted PNG file

## Environment Variables

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `MONGODB_URI` - MongoDB connection string
- `GOOGLE_MAPS_API_KEY` - Google Maps API key
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

## File Structure

```
src/
├── index.js              # Main entry point
├── cli/                  # Command line interface
├── parsers/              # State-specific parsers
├── services/             # Business logic services
├── models/               # Database models
├── utils/                # Utility functions
└── config/               # Configuration files
```

## Docker

The application includes a Dockerfile for easy deployment on remote servers.

## Testing

Run tests:
```bash
npm test
```
