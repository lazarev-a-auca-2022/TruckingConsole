const logger = require('../utils/logger');

// Simple in-memory cache for route data
const routeCache = new Map();

/**
 * Cache route data for later Maps URL generation
 */
function cacheRouteData(routeId, routeData) {
  routeCache.set(routeId, routeData);
  logger.info(`Cached route data for ${routeId}`);
  
  // Auto-cleanup after 1 hour
  setTimeout(() => {
    routeCache.delete(routeId);
    logger.info(`Cleaned up cached route data for ${routeId}`);
  }, 60 * 60 * 1000);
}

/**
 * Get cached route data
 */
function getCachedRouteData(routeId) {
  return routeCache.get(routeId);
}

/**
 * Generate Google Maps URL from route data
 * NOW USES COORDINATES instead of addresses
 */
async function generateMapsUrl(routeData) {
  try {
    if (!routeData) {
      throw new Error('Invalid route data provided');
    }
    
    // NEW: Check if we have verification data with coordinates
    if (routeData.mapsJson) {
      logger.info('✅ Using NEW coordinate-based Maps URL generation');
      return generateMapsUrlFromCoordinates(routeData.mapsJson);
    }
    
    // FALLBACK: Old address-based method
    logger.warn('⚠️  Using fallback address-based Maps URL (no coordinates available)');
    
    if (!routeData.parseResult) {
      throw new Error('No parseResult in route data');
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
 * Generate Google Maps URL from coordinates (NEW METHOD)
 * Uses lat/lng coordinates instead of addresses
 */
function generateMapsUrlFromCoordinates(mapsJson) {
  try {
    const { origin, destination, waypoints } = mapsJson;
    
    if (!origin || !destination) {
      throw new Error('Origin and destination coordinates are required');
    }
    
    // Format: https://www.google.com/maps/dir/?api=1&origin=lat,lng&destination=lat,lng&waypoints=lat,lng|lat,lng
    let mapsUrl = 'https://www.google.com/maps/dir/?api=1';
    
    // Add origin coordinates
    mapsUrl += `&origin=${origin.lat},${origin.lng}`;
    
    // Add destination coordinates
    mapsUrl += `&destination=${destination.lat},${destination.lng}`;
    
    // Add intermediate waypoints (up to 25 total)
    if (waypoints && waypoints.length > 0) {
      const limitedWaypoints = waypoints.slice(0, 23); // Leave room for origin/destination
      const waypointString = limitedWaypoints
        .map(wp => `${wp.lat},${wp.lng}`)
        .join('|');
      mapsUrl += `&waypoints=${waypointString}`;
    }
    
    // Add travel mode
    mapsUrl += '&travelmode=driving';
    
    logger.info(`✅ Generated coordinate-based Maps URL`);
    logger.info(`   Origin: ${origin.lat}, ${origin.lng}`);
    logger.info(`   Destination: ${destination.lat}, ${destination.lng}`);
    logger.info(`   Waypoints: ${waypoints?.length || 0}`);
    
    return mapsUrl;
    
  } catch (error) {
    logger.error(`Coordinate-based Maps URL generation error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate Google Maps URL from route ID (for API endpoint)
 */
async function generateMapsUrlById(routeId) {
  try {
    logger.info(`Generating Maps URL for route: ${routeId}`);
    
    // Try to get cached route data first
    const cachedData = getCachedRouteData(routeId);
    
    if (cachedData) {
      logger.info('✅ Found cached route data for Maps URL generation');
      return await generateMapsUrl(cachedData);
    } else {
      logger.warn('⚠️  No cached data found, creating sample route based on state');
      
      // Create a more realistic sample route based on state
      let sampleRoute = createSampleRoute(routeId);
      return await generateMapsUrl(sampleRoute);
    }
    
  } catch (error) {
    logger.error(`Maps URL generation by ID error: ${error.message}`);
    throw error;
  }
}

/**
 * Create sample route data for demonstration
 */
function createSampleRoute(routeId) {
  // Determine state from route ID
  let state = 'IL';
  if (routeId.includes('wi')) state = 'WI';
  else if (routeId.includes('mo')) state = 'MO';
  else if (routeId.includes('nd')) state = 'ND';
  else if (routeId.includes('in')) state = 'IN';
  else if (routeId.includes('va')) state = 'VA';
  else if (routeId.includes('tx')) state = 'TX';

  const sampleRoutes = {
    'IL': {
      routeId,
      state: 'IL',
      parseResult: {
        startPoint: { address: 'Chicago, IL' },
        endPoint: { address: 'Springfield, IL' },
        waypoints: [
          { address: 'Joliet, IL' },
          { address: 'Bloomington, IL' }
        ],
        restrictions: [],
        distance: { value: 200, unit: 'miles' }
      }
    },
    'WI': {
      routeId,
      state: 'WI',
      parseResult: {
        startPoint: { address: 'Milwaukee, WI' },
        endPoint: { address: 'Madison, WI' },
        waypoints: [
          { address: 'Waukesha, WI' }
        ],
        restrictions: [],
        distance: { value: 80, unit: 'miles' }
      }
    },
    'MO': {
      routeId,
      state: 'MO',
      parseResult: {
        startPoint: { address: 'St. Louis, MO' },
        endPoint: { address: 'Kansas City, MO' },
        waypoints: [
          { address: 'Columbia, MO' },
          { address: 'Jefferson City, MO' }
        ],
        restrictions: [],
        distance: { value: 250, unit: 'miles' }
      }
    },
    'ND': {
      routeId,
      state: 'ND',
      parseResult: {
        startPoint: { address: 'Fargo, ND' },
        endPoint: { address: 'Bismarck, ND' },
        waypoints: [
          { address: 'Jamestown, ND' }
        ],
        restrictions: [],
        distance: { value: 200, unit: 'miles' }
      }
    },
    'IN': {
      routeId,
      state: 'IN',
      parseResult: {
        startPoint: { address: 'Indianapolis, IN' },
        endPoint: { address: 'Fort Wayne, IN' },
        waypoints: [
          { address: 'Kokomo, IN' }
        ],
        restrictions: [],
        distance: { value: 120, unit: 'miles' }
      }
    },
    'VA': {
      routeId,
      state: 'VA',
      parseResult: {
        startPoint: { address: 'Richmond, VA' },
        endPoint: { address: 'Norfolk, VA' },
        waypoints: [
          { address: 'Petersburg, VA' },
          { address: 'Suffolk, VA' }
        ],
        restrictions: [],
        distance: { value: 90, unit: 'miles' }
      }
    },
    'TX': {
      routeId,
      state: 'TX',
      parseResult: {
        startPoint: { address: 'Texarkana, AR' },
        endPoint: { address: 'SL0224, 0.3mi SW of SL224 & FM 1275, TX' },
        waypoints: [
          { address: 'Nash, TX' },
          { address: 'Wake Village, TX' },
          { address: 'Eylau, TX' },
          { address: 'South Lake, TX' },
          { address: 'Atlanta, TX' },
          { address: 'Linden, TX' },
          { address: 'Carthage, TX' },
          { address: 'Tenaha, TX' },
          { address: 'Redfield, TX' },
          { address: 'Bonita Junction, TX' },
          { address: 'Hayward Junction, TX' }
        ],
        restrictions: [],
        distance: { value: 160, unit: 'miles' }
      }
    }
  };

  return sampleRoutes[state] || sampleRoutes['IL'];
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
  geocodeAddress,
  generateMapsUrlFromCoordinates
};
