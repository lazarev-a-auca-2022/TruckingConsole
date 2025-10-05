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
    
    // If we don't have enough real waypoints, create a generic route for the state
    if (waypoints.length < 2) {
      logger.warn('Insufficient waypoints, creating state-based route');
      const state = routeData.state || 'IL';
      const stateNames = {
        'IL': 'Illinois',
        'WI': 'Wisconsin', 
        'MO': 'Missouri',
        'ND': 'North Dakota',
        'IN': 'Indiana'
      };
      
      const stateName = stateNames[state] || 'Illinois';
      const mapsUrl = `https://www.google.com/maps/search/truck+routes+${stateName}?travelmode=driving`;
      
      logger.info(`Generated state-based Maps URL for ${stateName}`);
      return mapsUrl;
    }
    
    // Google Maps URL format with actual waypoints
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
    logger.info(`Generating Maps URL for route: ${routeId}`);
    
    // Since we don't cache route data anymore, generate a placeholder Maps URL
    // In a production app, you would fetch the route data from a database
    logger.warn('⚠️  Route caching disabled, generating placeholder Maps URL');
    
    // Create a fallback URL that searches for the general area based on state
    let searchLocation = 'Illinois'; // Default
    
    // Try to determine state from route ID or use default
    if (routeId.includes('wi')) searchLocation = 'Wisconsin';
    else if (routeId.includes('mo')) searchLocation = 'Missouri';
    else if (routeId.includes('nd')) searchLocation = 'North Dakota';
    else if (routeId.includes('in')) searchLocation = 'Indiana';
    
    const fallbackUrl = `https://www.google.com/maps/search/truck+routes+${searchLocation}`;
    
    logger.info(`Generated fallback Maps URL for ${searchLocation}`);
    return fallbackUrl;
    
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
