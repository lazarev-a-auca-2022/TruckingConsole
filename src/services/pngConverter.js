const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Generate a simple converted PNG (without Sharp dependency for now)
 */
async function generateConvertedPng(routeData) {
  try {
    logger.info(`Generating converted PNG for route: ${routeData.routeId || 'unknown'}`);
    
    // For now, create a simple placeholder PNG file
    // In production, you would use a proper image generation library
    const placeholderPng = await createSimplePng(routeData);
    
    logger.info(`Generated simple converted PNG (${placeholderPng.length} bytes)`);
    return placeholderPng;
    
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
    // Create simple placeholder data
    const placeholderData = {
      routeId: routeId,
      state: 'IL',
      parseResult: {
        startPoint: { address: 'Start Location' },
        endPoint: { address: 'End Location' },
        waypoints: [],
        restrictions: [],
        parseAccuracy: 0.85
      },
      timestamp: new Date().toISOString()
    };
    
    return await generateConvertedPng(placeholderData);
    
  } catch (error) {
    logger.error(`PNG conversion by ID error: ${error.message}`);
    throw error;
  }
}

/**
 * Create a simple PNG file (minimal implementation)
 */
async function createSimplePng(routeData) {
  // Minimal PNG file data (1x1 blue pixel)
  // This is a valid PNG file that browsers can display
  const pngData = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // bit depth, color type, compression, filter, interlace
    0x90, 0x77, 0x53, 0xde, // CRC
    0x00, 0x00, 0x00, 0x0c, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // compressed data
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4e, 0x44, // IEND
    0xae, 0x42, 0x60, 0x82  // CRC
  ]);
  
  return pngData;
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
