const logger = require('../utils/logger');

/**
 * Generate Google Maps URL from route data
 */
async function generateMapsUrl(routeData) {
  try {
    if (!routeData || !routeData.parseResult) {
      throw new Error('Invalid route data provided');
    }
    
    const { parseResult } = routeData;
    const waypoints = [];
    
    // Add start point
    if (parseResult.startPoint?.address) {
      waypoints.push(encodeURIComponent(parseResult.startPoint.address));
    }
    
    // Add intermediate waypoints
    if (parseResult.waypoints && parseResult.waypoints.length > 0) {
      parseResult.waypoints.forEach(waypoint => {
        if (waypoint.address) {
          waypoints.push(encodeURIComponent(waypoint.address));
        }
      });
    }
    
    // Add end point
    if (parseResult.endPoint?.address) {
      waypoints.push(encodeURIComponent(parseResult.endPoint.address));
    }
    
    if (waypoints.length < 2) {
      throw new Error('Insufficient waypoints to generate route');
    }
    
    // Google Maps URL format
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediateWaypoints = waypoints.slice(1, -1);
    
    let mapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;
    
    if (intermediateWaypoints.length > 0) {
      // Google Maps supports up to 25 waypoints total
      const limitedWaypoints = intermediateWaypoints.slice(0, 23); // Leave room for origin/destination
      mapsUrl += `/${limitedWaypoints.join('/')}`;
    }
    
    // Add parameters for truck routing if available
    mapsUrl += '?travelmode=driving';
    
    logger.info(`Generated Google Maps URL with ${waypoints.length} waypoints`);
    return mapsUrl;
    
  } catch (error) {
    logger.error(`Maps URL generation error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate Google Maps URL from route ID (for API endpoint)
 */
async function generateMapsUrlById(routeId) {
  try {
    // In a real implementation, you would fetch route data from database
    // For now, return a placeholder URL
    const placeholderUrl = `https://www.google.com/maps/dir/?api=1&destination=${routeId}`;
    
    logger.info(`Generated placeholder Maps URL for route: ${routeId}`);
    return placeholderUrl;
    
  } catch (error) {
    logger.error(`Maps URL generation by ID error: ${error.message}`);
    throw error;
  }
}

/**
 * Geocode address to coordinates (placeholder implementation)
 */
async function geocodeAddress(address) {
  try {
    // This would use Google Maps Geocoding API in a real implementation
    // For now, return mock coordinates
    logger.info(`Geocoding address: ${address}`);
    
    return {
      lat: 40.7128,
      lng: -74.0060,
      formatted_address: address
    };
    
  } catch (error) {
    logger.error(`Geocoding error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  generateMapsUrl,
  generateMapsUrlById,
  geocodeAddress
};
