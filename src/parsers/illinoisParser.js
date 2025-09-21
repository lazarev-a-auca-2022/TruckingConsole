const logger = require('../utils/logger');

/**
 * Parse Illinois truck permit text
 * Illinois permits typically contain route information in a structured format
 */
async function parseIllinois(text) {
  try {
    logger.info('Parsing Illinois permit text');
    
    const result = {
      startPoint: null,
      endPoint: null,
      waypoints: [],
      restrictions: [],
      distance: null,
      parseAccuracy: 0.8
    };
    
    // Common Illinois permit patterns
    const patterns = {
      route: /route\s*(\d+)|highway\s*(\d+)|interstate\s*(\d+)/gi,
      city: /(?:from|to|through|via)\s+([A-Za-z\s]+?)(?:,|\s+(?:IL|Illinois))/gi,
      restriction: /(?:restriction|limit|prohibited)[\s\S]*?(?:\.|$)/gi,
      distance: /(\d+(?:\.\d+)?)\s*(?:miles?|mi)/gi,
      direction: /(?:north|south|east|west|northbound|southbound|eastbound|westbound)/gi
    };
    
    // Extract cities and locations
    const cityMatches = [...text.matchAll(patterns.city)];
    const cities = cityMatches.map(match => match[1].trim()).filter(city => city.length > 2);
    
    if (cities.length >= 2) {
      result.startPoint = {
        address: `${cities[0]}, IL`,
        description: 'Start point'
      };
      result.endPoint = {
        address: `${cities[cities.length - 1]}, IL`,
        description: 'End point'
      };
      
      // Add intermediate cities as waypoints
      for (let i = 1; i < cities.length - 1; i++) {
        result.waypoints.push({
          address: `${cities[i]}, IL`,
          description: 'Waypoint'
        });
      }
    }
    
    // Extract route numbers
    const routeMatches = [...text.matchAll(patterns.route)];
    const routes = routeMatches.map(match => match[1] || match[2] || match[3]).filter(Boolean);
    
    if (routes.length > 0) {
      result.routeInfo = {
        highways: routes,
        description: `Route includes highways: ${routes.join(', ')}`
      };
    }
    
    // Extract restrictions
    const restrictionMatches = [...text.matchAll(patterns.restriction)];
    result.restrictions = restrictionMatches.map(match => ({
      type: 'general',
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
    
    // Calculate parse accuracy based on extracted data
    let accuracy = 0.3; // base accuracy
    if (result.startPoint) accuracy += 0.2;
    if (result.endPoint) accuracy += 0.2;
    if (result.waypoints.length > 0) accuracy += 0.1;
    if (result.restrictions.length > 0) accuracy += 0.1;
    if (result.distance) accuracy += 0.1;
    
    result.parseAccuracy = Math.min(accuracy, 1.0);
    
    logger.info(`Illinois parsing completed with accuracy: ${result.parseAccuracy}`);
    return result;
    
  } catch (error) {
    logger.error(`Illinois parsing error: ${error.message}`);
    throw new Error(`Failed to parse Illinois permit: ${error.message}`);
  }
}

module.exports = { parseIllinois };
