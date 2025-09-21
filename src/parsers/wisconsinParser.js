const logger = require('../utils/logger');

/**
 * Parse Wisconsin truck permit text
 * Wisconsin permits often use county-based routing
 */
async function parseWisconsin(text) {
  try {
    logger.info('Parsing Wisconsin permit text');
    
    const result = {
      startPoint: null,
      endPoint: null,
      waypoints: [],
      restrictions: [],
      distance: null,
      parseAccuracy: 0.8
    };
    
    // Wisconsin-specific patterns
    const patterns = {
      county: /([A-Za-z\s]+)\s+county/gi,
      city: /(?:from|to|through|via)\s+([A-Za-z\s]+?)(?:,|\s+(?:WI|Wisconsin))/gi,
      highway: /(?:STH|US|WIS|Highway)\s*(\d+)/gi,
      restriction: /(?:axle\s*weight|gross\s*weight|width|height|length)[\s\S]*?(?:\.|$)/gi,
      distance: /(\d+(?:\.\d+)?)\s*(?:miles?|mi)/gi,
      permit: /permit\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/gi
    };
    
    // Extract counties
    const countyMatches = [...text.matchAll(patterns.county)];
    const counties = countyMatches.map(match => match[1].trim()).filter(county => county.length > 3);
    
    // Extract cities
    const cityMatches = [...text.matchAll(patterns.city)];
    const cities = cityMatches.map(match => match[1].trim()).filter(city => city.length > 2);
    
    // Combine cities and counties for route points
    const locations = [...cities, ...counties.map(c => `${c} County`)];
    
    if (locations.length >= 2) {
      result.startPoint = {
        address: `${locations[0]}, WI`,
        description: 'Start point'
      };
      result.endPoint = {
        address: `${locations[locations.length - 1]}, WI`,
        description: 'End point'
      };
      
      // Add intermediate locations as waypoints
      for (let i = 1; i < locations.length - 1; i++) {
        result.waypoints.push({
          address: `${locations[i]}, WI`,
          description: 'Waypoint'
        });
      }
    }
    
    // Extract highways
    const highwayMatches = [...text.matchAll(patterns.highway)];
    const highways = highwayMatches.map(match => match[1]).filter(Boolean);
    
    if (highways.length > 0) {
      result.routeInfo = {
        highways: highways,
        description: `Route includes Wisconsin highways: ${highways.join(', ')}`
      };
    }
    
    // Extract permit number
    const permitMatches = [...text.matchAll(patterns.permit)];
    if (permitMatches.length > 0) {
      result.permitNumber = permitMatches[0][1];
    }
    
    // Extract restrictions (Wisconsin is particular about weight restrictions)
    const restrictionMatches = [...text.matchAll(patterns.restriction)];
    result.restrictions = restrictionMatches.map(match => ({
      type: 'weight/dimension',
      description: match[0].trim()
    }));
    
    // Extract distance
    const distanceMatches = [...text.matchAll(patterns.distance)];
    if (distanceMatches.length > 0) {
      result.distance = {
        value: parseFloat(distanceMatches[0][1]),
        unit: 'miles'
      };
    }
    
    // Calculate parse accuracy
    let accuracy = 0.3;
    if (result.startPoint) accuracy += 0.2;
    if (result.endPoint) accuracy += 0.2;
    if (counties.length > 0) accuracy += 0.1;
    if (highways.length > 0) accuracy += 0.1;
    if (result.permitNumber) accuracy += 0.1;
    
    result.parseAccuracy = Math.min(accuracy, 1.0);
    
    logger.info(`Wisconsin parsing completed with accuracy: ${result.parseAccuracy}`);
    return result;
    
  } catch (error) {
    logger.error(`Wisconsin parsing error: ${error.message}`);
    throw new Error(`Failed to parse Wisconsin permit: ${error.message}`);
  }
}

module.exports = { parseWisconsin };
