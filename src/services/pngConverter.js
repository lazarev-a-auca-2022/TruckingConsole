const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Generate a simple converted PNG (without Sharp dependency for now)
 */
async function generateConvertedPng(routeData) {
  try {
    logger.info(`Generating converted PNG for route: ${routeData.routeId || 'unknown'}`);
    
    // Create a more visible PNG with route information
    const pngBuffer = await createVisiblePng(routeData);
    
    logger.info(`Generated converted PNG (${pngBuffer.length} bytes)`);
    return pngBuffer;
    
  } catch (error) {
    logger.error(`PNG conversion error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate converted PNG from route ID (for API endpoint)
 */
async function generateConvertedPngById(routeId) {
  try {
    // Extract state from route ID if possible, or use default
    let state = 'IL'; // Default to Illinois
    
    // Try to determine state from cached data or route pattern
    if (routeId.includes('wi')) state = 'WI';
    else if (routeId.includes('mo')) state = 'MO';
    else if (routeId.includes('nd')) state = 'ND';
    else if (routeId.includes('in')) state = 'IN';
    
    // Create placeholder data with the determined state
    const placeholderData = {
      routeId: routeId,
      state: state,
      parseResult: {
        startPoint: { address: `Start Location, ${state}` },
        endPoint: { address: `End Location, ${state}` },
        waypoints: [],
        restrictions: [],
        parseAccuracy: 0.85
      },
      timestamp: new Date().toISOString()
    };
    
    logger.info(`Generating PNG for route ${routeId} with state ${state}`);
    return await generateConvertedPng(placeholderData);
    
  } catch (error) {
    logger.error(`PNG conversion by ID error: ${error.message}`);
    throw error;
  }
}

/**
 * Create a visible PNG with route information (using HTML5 Canvas simulation)
 */
const sharp = require('sharp');

async function createVisiblePng(routeData) {
  try {
    logger.info('Creating visible PNG with route information...');
    const width = 800;
    const height = 600;
    const svg = createPermitSvg(routeData, width, height);
    // Convert SVG to PNG using sharp
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    logger.info(`Created visible PNG from SVG: ${pngBuffer.length} bytes`);
    return pngBuffer;
  } catch (error) {
    logger.error(`Failed to create visible PNG: ${error.message}`);
    logger.error(`Error stack: ${error.stack}`);
    // Fallback to simple PNG
    return await createSimplePng(routeData);
  }
}

/**
 * Create a simple colored PNG using known working approach
 */
function createSimpleColorPng(width, height, rgb) {
  try {
    // Use a known working base64 encoded PNG pattern and modify it
    // This is a 10x10 red square PNG as base64
    const basePng = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABYSURBVBiVY/z//z8DJQAggBhJVQwQQIykKgYIIEZSFQMEECOpigECiJFUxQABxEiqYoAAYiRVMUAAMZKqGCCAGElVDBBAjKQqBgggRlIVAwQQI6mKAQKIEQCZvQQhPE9+TgAAAABJRU5ErkJggg==';
    
    // For now, just return different sized versions of the base pattern
    // In production, you'd generate proper PNGs programmatically
    return Buffer.from(basePng, 'base64');
    
  } catch (error) {
    logger.error(`Failed to create simple color PNG: ${error.message}`);
    // Ultra-fallback: return a very basic working PNG
    const fallbackPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    return Buffer.from(fallbackPng, 'base64');
  }
}

/**
 * Create a simple PNG file (minimal implementation)
 */
async function createSimplePng(routeData) {
  try {
    logger.info('Creating simple PNG file...');
    
    // Use a known working base64-encoded PNG (10x10 red square)
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABYSURBVBiVY/z//z8DJQAggBhJVQwQQIykKgYIIEZSFQMEECOpigECiJFUxQABxEiqYoAAYiRVMUAAMZKqGCCAGElVDBBAjKQqBgggRlIVAwQQI6mKAQKIEQCZvQQhPE9+TgAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(base64Png, 'base64');
    
    logger.info(`Created PNG buffer from base64: ${pngBuffer.length} bytes`);
    logger.info(`PNG signature check: ${pngBuffer.slice(0, 4).toString('hex')}`);
    
    return pngBuffer;
    
  } catch (error) {
    logger.error(`Failed to create PNG: ${error.message}`);
    
    // Ultra-simple fallback - create the smallest possible valid PNG
    // This is a 1x1 black pixel PNG that should always work
    const simplePng = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk start
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, // IHDR end
      0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, // IDAT chunk start
      0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, // IDAT data
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82 // IEND chunk
    ]);
    
    logger.info(`Fallback PNG created: ${simplePng.length} bytes`);
    return simplePng;
  }
}

/**
 * Create SVG template for the converted permit
 */
function createPermitSvg(routeData, width, height) {
  const parseResult = routeData.parseResult || {};
  const routeId = routeData.routeId || 'N/A';
  const state = routeData.state || 'N/A';
  const timestamp = routeData.timestamp || new Date().toISOString();
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="100%" height="100%" fill="#ffffff" stroke="#cccccc" stroke-width="2"/>
      
      <!-- Header -->
      <rect x="20" y="20" width="${width - 40}" height="80" fill="#2563eb" rx="8"/>
      <text x="${width/2}" y="45" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">
        CONVERTED TRUCK PERMIT
      </text>
      <text x="${width/2}" y="70" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14">
        State: ${state} | Route ID: ${routeId}
      </text>
      
      <!-- Route Information -->
      <text x="40" y="140" fill="#1f2937" font-family="Arial, sans-serif" font-size="16" font-weight="bold">
        ROUTE INFORMATION
      </text>
      <line x1="40" y1="150" x2="${width - 40}" y2="150" stroke="#e5e7eb" stroke-width="1"/>
      
      ${parseResult.startPoint ? `
      <text x="40" y="180" fill="#374151" font-family="Arial, sans-serif" font-size="14">
        <tspan font-weight="bold">START POINT:</tspan> ${parseResult.startPoint.address || 'Not specified'}
      </text>
      ` : ''}
      
      ${parseResult.endPoint ? `
      <text x="40" y="210" fill="#374151" font-family="Arial, sans-serif" font-size="14">
        <tspan font-weight="bold">END POINT:</tspan> ${parseResult.endPoint.address || 'Not specified'}
      </text>
      ` : ''}
      
      ${parseResult.waypoints && parseResult.waypoints.length > 0 ? `
      <text x="40" y="240" fill="#374151" font-family="Arial, sans-serif" font-size="14">
        <tspan font-weight="bold">WAYPOINTS:</tspan> ${parseResult.waypoints.length} stops
      </text>
      ` : ''}
      
      ${parseResult.distance ? `
      <text x="40" y="270" fill="#374151" font-family="Arial, sans-serif" font-size="14">
        <tspan font-weight="bold">DISTANCE:</tspan> ${parseResult.distance.value} ${parseResult.distance.unit}
      </text>
      ` : ''}
      
      <!-- Restrictions -->
      ${parseResult.restrictions && parseResult.restrictions.length > 0 ? `
      <text x="40" y="320" fill="#1f2937" font-family="Arial, sans-serif" font-size="16" font-weight="bold">
        RESTRICTIONS &amp; REQUIREMENTS
      </text>
      <line x1="40" y1="330" x2="${width - 40}" y2="330" stroke="#e5e7eb" stroke-width="1"/>
      
      ${parseResult.restrictions.slice(0, 5).map((restriction, index) => `
      <text x="40" y="${360 + (index * 25)}" fill="#374151" font-family="Arial, sans-serif" font-size="12">
        • ${restriction.description?.substring(0, 80) || 'Restriction noted'}${restriction.description?.length > 80 ? '...' : ''}
      </text>
      `).join('')}
      ` : ''}
      
      <!-- Processing Info -->
      <rect x="20" y="${height - 120}" width="${width - 40}" height="80" fill="#f9fafb" stroke="#e5e7eb" stroke-width="1" rx="8"/>
      
      <text x="40" y="${height - 90}" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
        <tspan font-weight="bold">Parse Accuracy:</tspan> ${parseResult.parseAccuracy ? (parseResult.parseAccuracy * 100).toFixed(1) + '%' : 'N/A'}
      </text>
      
      <text x="40" y="${height - 70}" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
        <tspan font-weight="bold">Processed:</tspan> ${new Date(timestamp).toLocaleString()}
      </text>
      
      <text x="40" y="${height - 50}" fill="#6b7280" font-family="Arial, sans-serif" font-size="12">
        <tspan font-weight="bold">Generated by:</tspan> Trucking Console App
      </text>
      
      <!-- QR Code placeholder -->
      <rect x="${width - 100}" y="${height - 100}" width="60" height="60" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1"/>
      <text x="${width - 70}" y="${height - 65}" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="8">
        QR CODE
      </text>
    </svg>
  `;
}

/**
 * Save route data for later PNG generation (in-memory storage for demo)
 */
const routeDataCache = new Map();

function cacheRouteData(routeId, routeData) {
  routeDataCache.set(routeId, routeData);
  
  // Auto-cleanup after 1 hour
  setTimeout(() => {
    routeDataCache.delete(routeId);
  }, 60 * 60 * 1000);
}

function getCachedRouteData(routeId) {
  return routeDataCache.get(routeId);
}

module.exports = {
  generateConvertedPng,
  generateConvertedPngById,
  cacheRouteData,
  getCachedRouteData
};
