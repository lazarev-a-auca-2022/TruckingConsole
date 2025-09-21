const logger = require('../utils/logger');

/**
 * Parse North Dakota truck permit text
 * North Dakota permits often include specific seasonal restrictions and agricultural considerations
 */
async function parseNorthDakota(text) {
  try {
    logger.info('Parsing North Dakota permit text');
    
    const result = {
      startPoint: null,
      endPoint: null,
      waypoints: [],
      restrictions: [],
      distance: null,
      parseAccuracy: 0.8
    };
    
    // North Dakota-specific patterns
    const patterns = {
      city: /(?:from|to|through|via)\s+([A-Za-z\s]+?)(?:,|\s+(?:ND|North\s*Dakota))/gi,
      highway: /(?:Interstate|I-|US|ND|Highway)\s*(\d+)/gi,
      seasonal: /(?:seasonal|spring|summer|fall|winter|harvest|thaw)[\s\S]*?(?:\.|$)/gi,
      restriction: /(?:axle\s*limit|weight\s*restriction|load\s*limit)[\s\S]*?(?:\.|$)/gi,
      distance: /(\d+(?:\.\d+)?)\s*(?:miles?|mi)/gi,
      county: /([A-Za-z\s]+)\s+county/gi,
      permit: /permit\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/gi
    };
    
    // Extract cities
    const cityMatches = [...text.matchAll(patterns.city)];
    const cities = cityMatches.map(match => match[1].trim()).filter(city => city.length > 2);
    
    // Extract counties (important in North Dakota)
    const countyMatches = [...text.matchAll(patterns.county)];
    const counties = countyMatches.map(match => match[1].trim()).filter(county => county.length > 3);
    
    // Combine cities and counties for routing
    const locations = [...cities, ...counties.map(c => `${c} County`)];
    
    if (locations.length >= 2) {
      result.startPoint = {
        address: `${locations[0]}, ND`,
        description: 'Start point'
      };
      result.endPoint = {
        address: `${locations[locations.length - 1]}, ND`,
        description: 'End point'
      };
      
      // Add intermediate locations as waypoints
      for (let i = 1; i < locations.length - 1; i++) {
        result.waypoints.push({
          address: `${locations[i]}, ND`,
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
        description: `Route includes North Dakota highways: ${highways.join(', ')}`
      };
    }
    
    // Extract seasonal restrictions (common in ND)
    const seasonalMatches = [...text.matchAll(patterns.seasonal)];
    const seasonalRestrictions = seasonalMatches.map(match => ({
      type: 'seasonal',
      description: match[0].trim()
    }));
    
    // Extract weight/load restrictions
    const restrictionMatches = [...text.matchAll(patterns.restriction)];
    const weightRestrictions = restrictionMatches.map(match => ({
      type: 'weight',
      description: match[0].trim()
    }));
    
    result.restrictions = [...seasonalRestrictions, ...weightRestrictions];
    
    // Extract permit number
    const permitMatches = [...text.matchAll(patterns.permit)];
    if (permitMatches.length > 0) {
      result.permitNumber = permitMatches[0][1];
    }
    
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
    if (result.restrictions.length > 0) accuracy += 0.1;
    
    result.parseAccuracy = Math.min(accuracy, 1.0);
    
    logger.info(`North Dakota parsing completed with accuracy: ${result.parseAccuracy}`);
    return result;
    
  } catch (error) {
    logger.error(`North Dakota parsing error: ${error.message}`);
    throw new Error(`Failed to parse North Dakota permit: ${error.message}`);
  }
}

module.exports = { parseNorthDakota };
