const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { parsePermit } = require('./services/permitParser');
const { generateMapsUrlById } = require('./services/mapsService');
const { generateGpxById } = require('./services/gpxService');
const { connectDatabase } = require('./config/database');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  logger.info(`🌐 ${timestamp} - ${req.method} ${req.url} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')?.substring(0, 100)}`);
  next();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads';
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/bmp',
      'image/tiff',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Routes
app.get('/', (req, res) => {
  // Serve the main HTML page
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/api', (req, res) => {
  res.json({
    message: 'Trucking Console API - Route Parsing & Google Maps Integration',
    version: '1.0.0',
    description: 'Parse trucking permits and convert route data into Google Maps URLs and GPX files',
    endpoints: [
      'POST /api/parse - Upload and parse permit file (PDF or image)',
      'GET /api/maps-url/:id - Get Google Maps URL for the route',
      'GET /api/gpx/:id - Download GPX file for Garmin navigation'
    ],
    workflow: [
      '1. Upload permit document (PDF or image)',
      '2. Extract route data (start/end points, waypoints, restrictions)',
      '3. Generate Google Maps URL with all route points',
      '4. Export GPX file for Garmin/navigation devices'
    ]
  });
});

app.post('/api/parse', upload.single('permit'), async (req, res) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { state } = req.body;
    if (!state) {
      return res.status(400).json({ error: 'State parameter is required' });
    }

    logger.info(`Parsing uploaded file: ${req.file.filename} for state: ${state}`);
    tempFilePath = req.file.path;

    const result = await parsePermit(req.file.path, state);
    
    // Clean up uploaded file after processing
    await fs.remove(tempFilePath).catch(() => {});
    
    res.json({
      success: true,
      data: result,
      message: 'Permit parsed successfully. Route data extracted and ready for Google Maps integration.',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Parse API error: ${error.message}`);
    
    // Clean up uploaded file on error
    if (tempFilePath) {
      await fs.remove(tempFilePath).catch(() => {});
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/maps-url/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const mapsUrl = await generateMapsUrlById(routeId);
    
    res.json({
      success: true,
      mapsUrl,
      routeId,
      message: 'Google Maps URL generated successfully. Click the URL to view route in Google Maps.',
      instructions: 'Copy this URL to open the route in Google Maps or share with drivers.'
    });

  } catch (error) {
    logger.error(`Maps URL API error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/gpx/:routeId', async (req, res) => {
  try {
    const { routeId } = req.params;
    const gpxData = await generateGpxById(routeId);
    
    res.set({
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="truck_route_${routeId}.gpx"`
    });
    
    res.send(gpxData);

  } catch (error) {
    logger.error(`GPX API error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Trucking Console - Route Parser'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error(`Unhandled error: ${error.message}`);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'POST /api/parse',
      'GET /api/maps-url/:id',
      'GET /api/gpx/:id',
      'GET /health'
    ]
  });
});

async function startServer(port = 3000) {
  try {
    // Connect to database
    await connectDatabase();
    
    // Ensure directories exist
    await fs.ensureDir('./uploads');
    await fs.ensureDir('./temp');
    await fs.ensureDir('./output');

    app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      console.log(`\n🚛 Trucking Console Server - Route Parser & Google Maps Integration`);
      console.log(`📡 Server running on http://localhost:${port}`);
      console.log(`📋 API endpoints available at http://localhost:${port}/api`);
      console.log(`❤️  Health check: http://localhost:${port}/health`);
      console.log(`\n✨ Core Features:`);
      console.log(`   📄 Parse permit documents (PDF/images)`);
      console.log(`   🗺️  Generate Google Maps URLs`);
      console.log(`   📍 Export GPX files for navigation`);
      console.log(`\nPress Ctrl+C to stop the server\n`);
    });

  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    throw error;
  }
}

module.exports = { app, startServer };
