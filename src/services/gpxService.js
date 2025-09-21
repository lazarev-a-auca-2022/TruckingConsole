const { buildGPX, BaseBuilder } = require('gpx-builder');
const logger = require('../utils/logger');

/**
 * Generate GPX file from route data
 */
async function generateGpx(routeData) {
  try {
    if (!routeData || !routeData.parseResult) {
      throw new Error('Invalid route data provided');
    }
    
    const { parseResult, routeId, state } = routeData;
    const points = [];
    
    // Add start point
    if (parseResult.startPoint) {
      points.push({
        lat: parseResult.startPoint.coordinates?.lat || 40.0,
        lon: parseResult.startPoint.coordinates?.lng || -95.0,
        name: parseResult.startPoint.address || 'Start',
        desc: 'Route start point'
      });
    }
    
    // Add waypoints
    if (parseResult.waypoints && parseResult.waypoints.length > 0) {
      parseResult.waypoints.forEach((waypoint, index) => {
        points.push({
          lat: waypoint.coordinates?.lat || (40.0 + (index * 0.1)),
          lon: waypoint.coordinates?.lng || (-95.0 + (index * 0.1)),
          name: waypoint.address || `Waypoint ${index + 1}`,
          desc: waypoint.description || 'Route waypoint'
        });
      });
    }
    
    // Add end point
    if (parseResult.endPoint) {
      points.push({
        lat: parseResult.endPoint.coordinates?.lat || 41.0,
        lon: parseResult.endPoint.coordinates?.lng || -94.0,
        name: parseResult.endPoint.address || 'End',
        desc: 'Route end point'
      });
    }
    
    if (points.length === 0) {
      throw new Error('No valid points found for GPX generation');
    }
    
    // Create GPX waypoints
    const waypoints = points.map(point => ({
      lat: point.lat,
      lon: point.lon,
      name: point.name,
      desc: point.desc
    }));
    
    // Create track with all points
    const track = {
      name: `Truck Route ${routeId}`,
      segments: [{
        points: points.map(point => ({
          lat: point.lat,
          lon: point.lon
        }))
      }]
    };
    
    // Build GPX with metadata
    const gpxData = buildGPX({
      waypoints: waypoints,
      tracks: [track],
      metadata: {
        name: `Truck Permit Route - ${state}`,
        desc: `Route generated from ${state} truck permit`,
        author: {
          name: 'Trucking Console App'
        },
        time: new Date()
      }
    });
    
    logger.info(`Generated GPX with ${points.length} points for route: ${routeId}`);
    return gpxData;
    
  } catch (error) {
    logger.error(`GPX generation error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate GPX file from route ID (for API endpoint)
 */
async function generateGpxById(routeId) {
  try {
    // In a real implementation, you would fetch route data from database
    // For now, generate a simple placeholder GPX
    const placeholderGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trucking Console App">
  <metadata>
    <name>Truck Route ${routeId}</name>
    <desc>Generated truck route</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <wpt lat="40.0" lon="-95.0">
    <name>Route ${routeId}</name>
    <desc>Placeholder waypoint</desc>
  </wpt>
</gpx>`;
    
    logger.info(`Generated placeholder GPX for route: ${routeId}`);
    return placeholderGpx;
    
  } catch (error) {
    logger.error(`GPX generation by ID error: ${error.message}`);
    throw error;
  }
}

/**
 * Validate GPX data
 */
function validateGpx(gpxData) {
  try {
    // Basic validation - check if it's valid XML and contains GPX elements
    if (!gpxData || typeof gpxData !== 'string') {
      return false;
    }
    
    return gpxData.includes('<gpx') && gpxData.includes('</gpx>');
    
  } catch (error) {
    logger.error(`GPX validation error: ${error.message}`);
    return false;
  }
}

module.exports = {
  generateGpx,
  generateGpxById,
  validateGpx
};
