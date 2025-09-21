const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { parsePermit } = require('./services/permitParser');
const { generateMapsUrlById } = require('./services/mapsService');
const { generateGpxById } = require('./services/gpxService');
const { generateConvertedPngById, getCachedRouteData, cacheRouteData } = require('./services/pngConverter');
const { connectDatabase } = require('./config/database');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

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
    message: 'Trucking Console API',
    version: '1.0.0',
    endpoints: [
      'POST /api/parse - Upload and parse permit file (PDF or image)',
      'GET /api/routes/:id - Get parsed route details',
      'GET /api/maps-url/:id - Get Google Maps URL',
      'GET /api/gpx/:id - Download GPX file',
      'GET /api/convert-png/:id - Download converted PNG'
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
    
    // Cache the route data for PNG conversion
    cacheRouteData(result.routeId, result);
    
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

// Test endpoint for PNG generation
app.get('/api/test-png', async (req, res) => {
  try {
    logger.info('=== TEST PNG ENDPOINT ===');
    
    // Use a hardcoded working PNG for testing
    const testPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABYSURBVBiVY/z//z8DJQAggBhJVQwQQIykKgYIIEZSFQMEECOpigECiJFUxQABxEiqYoAAYiRVMUAAMZKqGCCAGElVDBBAjKQqBgggRlIVAwQQI6mKAQKIEQCZvQQhPE9+TgAAAABJRU5ErkJggg==';
    const testPng = Buffer.from(testPngBase64, 'base64');
    
    logger.info(`Test PNG generated: ${testPng.length} bytes`);
    logger.info(`PNG signature: ${testPng.slice(0, 8).toString('hex')}`);
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': testPng.length,
      'Content-Disposition': 'attachment; filename="test.png"',
      'Cache-Control': 'no-cache'
    });
    
    res.send(testPng);
    logger.info('Test PNG sent successfully');
    
  } catch (error) {
    logger.error(`Test PNG error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint that bypasses all PNG generation
app.get('/api/debug-png', async (req, res) => {
  try {
    logger.info('=== DEBUG PNG ENDPOINT ===');
    
    // Create a simple text-based "PNG" for debugging
    const debugText = `Debug PNG - Route: debug123 - State: IL - Time: ${new Date().toISOString()}`;
    
    // Convert to a simple working PNG
    const simplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAALhSURBVHja7d1NaxNBGAbgNxGFWkSw1YK01Q/wUFvBg1pQwYMHL168ePHgxYsXL168ePHgxYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168ePHixYsXL168eAEA';
    const debugPng = Buffer.from(simplePngBase64, 'base64');
    
    logger.info(`Debug PNG: ${debugPng.length} bytes`);
    logger.info(`Debug text: ${debugText}`);
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': debugPng.length,
      'Content-Disposition': 'attachment; filename="debug.png"'
    });
    
    res.send(debugPng);
    logger.info('Debug PNG sent successfully');
    
  } catch (error) {
    logger.error(`Debug PNG error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/convert-png/:routeId', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { routeId } = req.params;
    logger.info(`=== PNG CONVERSION REQUEST START ===`);
    logger.info(`Route ID: ${routeId}`);
    logger.info(`Request IP: ${req.ip}`);
    logger.info(`User Agent: ${req.get('User-Agent')}`);
    
    // Try to get cached route data first
    const cachedData = getCachedRouteData(routeId);
    let pngData;
    
    if (cachedData) {
      logger.info('✅ Found cached route data');
      logger.info(`Cached data keys: ${Object.keys(cachedData)}`);
      pngData = await generateConvertedPng(cachedData);
    } else {
      logger.info('⚠️  No cached data found, using placeholder');
      pngData = await generateConvertedPngById(routeId);
    }
    
    if (!pngData) {
      throw new Error('PNG generation returned null/undefined');
    }
    
    if (!Buffer.isBuffer(pngData)) {
      logger.error(`PNG data is not a buffer: ${typeof pngData}`);
      throw new Error('PNG data is not a valid buffer');
    }
    
    if (pngData.length === 0) {
      throw new Error('Generated PNG data is empty');
    }
    
    logger.info(`✅ PNG generated successfully: ${pngData.length} bytes`);
    logger.info(`PNG starts with: ${pngData.slice(0, 8).toString('hex')}`);
    
    // Set response headers
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pngData.length,
      'Content-Disposition': `attachment; filename="converted_permit_${routeId}.png"`,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    
    logger.info(`📤 Sending PNG response...`);
    
    // Send the PNG data
    res.send(pngData);
    
    const endTime = Date.now();
    logger.info(`✅ PNG response sent successfully in ${endTime - startTime}ms`);
    logger.info(`=== PNG CONVERSION REQUEST END ===`);

  } catch (error) {
    const endTime = Date.now();
    logger.error(`❌ PNG CONVERSION ERROR (${endTime - startTime}ms):`);
    logger.error(`Error message: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    logger.error(`=== PNG CONVERSION REQUEST FAILED ===`);
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
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
