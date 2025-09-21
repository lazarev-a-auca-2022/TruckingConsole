const logger = require('../utils/logger');

/**
 * Parse Missouri truck permit text
 * Missouri permits often include specific route restrictions and bridge information
 */
async function parseMissouri(text) {
  try {
    logger.info('Parsing Missouri permit text');
    
    const result = {
      startPoint: null,
      endPoint: null,
      waypoints: [],
      restrictions: [],
      distance: null,
      parseAccuracy: 0.8
    };
    
    // Missouri-specific patterns
    const patterns = {
      city: /(?:from|to|through|via)\s+([A-Za-z\s]+?)(?:,|\s+(?:MO|Missouri))/gi,
      highway: /(?:Interstate|I-|US|Route|MO)\s*(\d+)/gi,
      bridge: /bridge[\s\S]*?(?:\.|$)/gi,
      restriction: /(?:no\s*travel|restricted|prohibited|weight\s*limit)[\s\S]*?(?:\.|$)/gi,
      distance: /(\d+(?:\.\d+)?)\s*(?:miles?|mi)/gi,
      direction: /(?:north|south|east|west)bound/gi,
      permit: /permit\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/gi
    };
    
    // Extract cities
    const cityMatches = [...text.matchAll(patterns.city)];
    const cities = cityMatches.map(match => match[1].trim()).filter(city => city.length > 2);
    
    if (cities.length >= 2) {
      result.startPoint = {
        address: `${cities[0]}, MO`,
        description: 'Start point'
      };
      result.endPoint = {
        address: `${cities[cities.length - 1]}, MO`,
        description: 'End point'
      };
      
      // Add intermediate cities as waypoints
      for (let i = 1; i < cities.length - 1; i++) {
        result.waypoints.push({
          address: `${cities[i]}, MO`,
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
        description: `Route includes Missouri highways: ${highways.join(', ')}`
      };
    }
    
    // Extract bridge information (important for Missouri)
    const bridgeMatches = [...text.matchAll(patterns.bridge)];
    const bridgeRestrictions = bridgeMatches.map(match => ({
      type: 'bridge',
      description: match[0].trim()
    }));
    
    // Extract general restrictions
    const restrictionMatches = [...text.matchAll(patterns.restriction)];
    const generalRestrictions = restrictionMatches.map(match => ({
      type: 'general',
      description: match[0].trim()
    }));
    
    result.restrictions = [...bridgeRestrictions, ...generalRestrictions];
    
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
    
    logger.info(`Missouri parsing completed with accuracy: ${result.parseAccuracy}`);
    return result;
    
  } catch (error) {
    logger.error(`Missouri parsing error: ${error.message}`);
    throw new Error(`Failed to parse Missouri permit: ${error.message}`);
  }
}

module.exports = { parseMissouri };
