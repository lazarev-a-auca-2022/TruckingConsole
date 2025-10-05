# Trucking Console App - Route Parser & Google Maps Integration

A console-only application for parsing truck permit documents and converting route data into Google Maps URLs and GPX files for navigation.

## ✨ What This App Actually Does

**CORRECT WORKFLOW**: 
1. **Parse trucking permits** (PDF/images) to extract route data
2. **Generate Google Maps URLs** with start/end points and waypoints  
3. **Export GPX files** for Garmin navigation devices

**NOT**: Generate new permit images (this was a misunderstanding that has been corrected)

## 🏗️ Architecture

### Two-Stage Processing:

#### Stage 1: Text Extraction
- **PDFs**: Direct text extraction using pdf2json
- **Images**: OCR using OpenRouter AI vision models (with demo fallback)

#### Stage 2: State-Specific Parsing  
- **Illinois**: City-based routing with highway numbers
- **Wisconsin**: County-based routing, axle weight restrictions
- **Missouri**: Bridge restrictions, specific route requirements
- **North Dakota**: Seasonal restrictions, agricultural considerations  
- **Indiana**: Interstate and toll road information

## 🚀 Features

- **Multi-format support**: PDF, PNG, JPG, and other image formats
- **State-specific parsing**: Custom logic for 5 states (IL, WI, MO, ND, IN)
- **Google Maps integration**: Direct URLs with waypoints
- **GPX export**: Compatible with Garmin and other navigation devices
- **Demo mode**: Works without OCR API for testing
- **Intelligent fallbacks**: Graceful degradation when services fail

## 📋 Supported States

- **Illinois (IL)**: Highway and city-based routing
- **Wisconsin (WI)**: County-based routing with weight restrictions
- **Missouri (MO)**: Bridge and route-specific restrictions
- **North Dakota (ND)**: Seasonal and agricultural considerations
- **Indiana (IN)**: Interstate and toll road routing

## 🛠️ Installation

```bash
# Clone repository
git clone <repository-url>
cd TruckingConsole

# Install dependencies
npm install

# Set up environment (optional - for full OCR functionality)
echo "OPENROUTER_API_KEY=your_api_key_here" > .env

# Start server
npm start
```

## 📖 Usage

### Web Interface
1. Open http://localhost:3000
2. Upload a permit file (PDF or image)
3. Select the state
4. Click "Process Permit"
5. Get Google Maps URL and/or download GPX file

### API Endpoints

```bash
# Parse permit
POST /api/parse
Content-Type: multipart/form-data
Body: permit file + state parameter

# Get Google Maps URL
GET /api/maps-url/:routeId

# Download GPX file
GET /api/gpx/:routeId
```

## 🔧 Configuration

### Environment Variables (Optional)
```bash
OPENROUTER_API_KEY=your_openrouter_api_key  # For full OCR functionality
MONGODB_URI=mongodb://localhost:27017/trucking  # Database connection
PORT=3000  # Server port
```

### Demo Mode
- App works without API keys using sample text
- Perfect for testing the parsing logic
- Shows how each state's parser works

## 🧪 Testing

```bash
# Run tests
npm test

# Test specific parser
npm run test:parsers

# Test API endpoints
npm run test:api
```

## 📁 File Structure

```
src/
├── parsers/           # State-specific parsing logic
│   ├── illinoisParser.js
│   ├── wisconsinParser.js
│   ├── missouriParser.js
│   ├── northDakotaParser.js
│   └── indianaParser.js
├── services/
│   ├── permitParser.js    # Main parsing orchestrator
│   ├── mapsService.js     # Google Maps URL generation
│   ├── gpxService.js      # GPX file generation
│   └── openRouterOcr.js   # OCR service
└── server.js              # Express server
```

## 🎯 Example Workflow

1. **Input**: Upload Illinois permit image
2. **OCR**: Extract text: "Route from Chicago, IL to Springfield, IL via I-55 South"
3. **Parse**: Illinois parser identifies:
   - Start: "Chicago, IL"
   - End: "Springfield, IL" 
   - Highway: "I-55"
4. **Output**: 
   - Google Maps URL: `https://www.google.com/maps/dir/Chicago,+IL/Springfield,+IL`
   - GPX file with waypoints

## 🔮 Future Enhancements

- Support for all 48 contiguous US states
- Real-time traffic integration
- Multiple navigation format exports
- Route optimization suggestions
- Restriction compliance checking

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/new-state`)
3. Add state parser in `src/parsers/`
4. Update `STATE_PARSERS` mapping
5. Add tests and documentation
6. Submit pull request

## 📜 License

[License information]

## ❓ FAQ

**Q: Why not just use general OCR?**
A: State permits have different formats. State-specific parsers ensure accurate route extraction.

**Q: Can I add more states?**
A: Yes! Create a new parser in `src/parsers/` and add it to the `STATE_PARSERS` mapping.

**Q: Does it work without API keys?**
A: Yes! Demo mode uses sample text to demonstrate parsing functionality.
