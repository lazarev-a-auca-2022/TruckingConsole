const logger = require('../utils/logger');

/**
 * Parse Indiana truck permit text
 * Indiana permits often include specific interstate and toll road information
 */
async function parseIndiana(text) {
  try {
    logger.info('Parsing Indiana permit text');
    
    const result = {
      startPoint: null,
      endPoint: null,
      waypoints: [],
      restrictions: [],
      distance: null,
      parseAccuracy: 0.8
    };
    
    // Indiana-specific patterns
    const patterns = {
      city: /(?:from|to|through|via)\s+([A-Za-z\s]+?)(?:,|\s+(?:IN|Indiana))/gi,
      highway: /(?:Interstate|I-|US|IN|SR)\s*(\d+)/gi,
      tollRoad: /toll\s*road|indiana\s*toll/gi,
      restriction: /(?:height\s*restriction|weight\s*limit|bridge\s*restriction)[\s\S]*?(?:\.|$)/gi,
      distance: /(\d+(?:\.\d+)?)\s*(?:miles?|mi)/gi,
      county: /([A-Za-z\s]+)\s+county/gi,
      permit: /permit\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/gi,
      toll: /toll[\s\S]*?(?:\.|$)/gi
    };
    
    // Extract cities
    const cityMatches = [...text.matchAll(patterns.city)];
    const cities = cityMatches.map(match => match[1].trim()).filter(city => city.length > 2);
    
    // Extract counties
    const countyMatches = [...text.matchAll(patterns.county)];
    const counties = countyMatches.map(match => match[1].trim()).filter(county => county.length > 3);
    
    // Combine cities and counties for routing
    const locations = [...cities, ...counties.map(c => `${c} County`)];
    
    if (locations.length >= 2) {
      result.startPoint = {
        address: `${locations[0]}, IN`,
        description: 'Start point'
      };
      result.endPoint = {
        address: `${locations[locations.length - 1]}, IN`,
        description: 'End point'
      };
      
      // Add intermediate locations as waypoints
      for (let i = 1; i < locations.length - 1; i++) {
        result.waypoints.push({
          address: `${locations[i]}, IN`,
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
        description: `Route includes Indiana highways: ${highways.join(', ')}`
      };
    }
    
    // Check for toll road information
    const tollRoadMatches = [...text.matchAll(patterns.tollRoad)];
    if (tollRoadMatches.length > 0) {
      result.tollInfo = {
        hasTolls: true,
        description: 'Route includes toll roads'
      };
    }
    
    // Extract toll-specific restrictions
    const tollMatches = [...text.matchAll(patterns.toll)];
    const tollRestrictions = tollMatches.map(match => ({
      type: 'toll',
      description: match[0].trim()
    }));
    
    // Extract general restrictions
    const restrictionMatches = [...text.matchAll(patterns.restriction)];
    const generalRestrictions = restrictionMatches.map(match => ({
      type: 'general',
      description: match[0].trim()
    }));
    
    result.restrictions = [...tollRestrictions, ...generalRestrictions];
    
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
    if (highways.length > 0) accuracy += 0.1;
    if (result.restrictions.length > 0) accuracy += 0.1;
    if (result.permitNumber) accuracy += 0.1;
    
    result.parseAccuracy = Math.min(accuracy, 1.0);
    
    logger.info(`Indiana parsing completed with accuracy: ${result.parseAccuracy}`);
    return result;
    
  } catch (error) {
    logger.error(`Indiana parsing error: ${error.message}`);
    throw new Error(`Failed to parse Indiana permit: ${error.message}`);
  }
}

module.exports = { parseIndiana };
