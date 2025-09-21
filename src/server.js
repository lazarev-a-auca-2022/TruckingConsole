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
  res.json({
    message: 'Trucking Console API',
    version: '1.0.0',
    endpoints: [
      'POST /api/parse - Upload and parse permit file (PDF or image)',
      'GET /api/routes/:id - Get parsed route details',
      'GET /api/maps-url/:id - Get Google Maps URL',
      'GET /api/gpx/:id - Download GPX file'
    ]
  });
});

app.post('/api/parse', upload.single('permit'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { state } = req.body;
    if (!state) {
      return res.status(400).json({ error: 'State parameter is required' });
    }

    logger.info(`Parsing uploaded file: ${req.file.filename} for state: ${state}`);

    const result = await parsePermit(req.file.path, state);
    
    // Clean up uploaded file
    await fs.remove(req.file.path);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Parse API error: ${error.message}`);
    
    // Clean up uploaded file on error
    if (req.file?.path) {
      await fs.remove(req.file.path).catch(() => {});
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
    // In a real implementation, you'd fetch route data from database
    // For now, we'll return a placeholder
    const mapsUrl = await generateMapsUrlById(routeId);
    
    res.json({
      success: true,
      mapsUrl,
      routeId
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
      'Content-Disposition': `attachment; filename="route_${routeId}.gpx"`
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
    uptime: process.uptime()
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
    error: 'Endpoint not found'
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
      console.log(`\n🚛 Trucking Console Server`);
      console.log(`📡 Server running on http://localhost:${port}`);
      console.log(`📋 API endpoints available at http://localhost:${port}/api`);
      console.log(`❤️  Health check: http://localhost:${port}/health`);
      console.log(`\nPress Ctrl+C to stop the server\n`);
    });

  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    throw error;
  }
}

module.exports = { app, startServer };
