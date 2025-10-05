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
    
    // Enhanced Missouri-specific patterns for detailed route parsing
    const patterns = {
      city: /(?:from|to|through|via)\s+([A-Za-z\s]+?)(?:,|\s+(?:MO|Missouri))/gi,
      highway: /(?:Interstate|I-|US|Route|MO)\s*(\d+)/gi,
      bridge: /bridge[\s\S]*?(?:\.|$)/gi,
      restriction: /(?:no\s*travel|restricted|prohibited|weight\s*limit)[\s\S]*?(?:\.|$)/gi,
      distance: /(\d+(?:\.\d+)?)\s*(?:miles?|mi)/gi,
      direction: /(?:north|south|east|west)bound/gi,
      permit: /permit\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/gi,
      // Enhanced patterns for detailed route parsing
      borderStart: /border\s*start[:\s]*([^-]+)-\s*(I-\d+|US-\d+)/gi,
      borderEnd: /border\s*end[:\s]*([^-]+)-\s*(I-\d+|US-\d+)/gi,
      authorizedRoute: /authorized\s*route[:\s]*([\s\S]*?)(?:total\s*distance|$)/gi,
      routeStep: /\d+\.\s*\[state\]\s*([^(]+)\(([^)]+)\)/gi,
      exitNumber: /(?:exit|take\s*exit)\s*(\d+[A-Z]?)/gi,
      rampDirection: /take\s*ramp\s*on\s*the\s*(left|right)/gi
    };
    
    // Try to extract border start and end first (most reliable for route endpoints)
    const borderStartMatch = text.match(patterns.borderStart);
    const borderEndMatch = text.match(patterns.borderEnd);
    
    if (borderStartMatch) {
      const startLocation = borderStartMatch[0].replace(/border\s*start[:\s]*/gi, '').trim();
      result.startPoint = {
        address: startLocation.replace(/\s*-\s*I-\d+.*/, ''),
        description: 'Route start point',
        highway: startLocation.match(/(I-\d+|US-\d+)/)?.[0]
      };
    }
    
    if (borderEndMatch) {
      const endLocation = borderEndMatch[0].replace(/border\s*end[:\s]*/gi, '').trim();
      result.endPoint = {
        address: endLocation.replace(/\s*-\s*I-\d+.*/, ''),
        description: 'Route end point', 
        highway: endLocation.match(/(I-\d+|US-\d+)/)?.[0]
      };
    }
    
    // Extract major highways and create waypoints from route steps
    const routeSteps = [...text.matchAll(patterns.routeStep)];
    const majorCities = new Set();
    const highways = new Set();
    
    routeSteps.forEach(match => {
      const step = match[1].trim();
      const distance = match[2];
      
      // Extract city names from route steps
      const cityMatch = step.match(/(?:toward|to)\s+([A-Z\s]+?)(?:\s|\/|$)/);
      if (cityMatch) {
        const city = cityMatch[1].trim();
        if (city.length > 2 && city !== 'THE' && city !== 'GREAT' && city !== 'RIVER') {
          majorCities.add(city);
        }
      }
      
      // Extract highway numbers
      const highwayMatch = step.match(/(I-\d+|US-\d+|IL-\d+)/g);
      if (highwayMatch) {
        highwayMatch.forEach(hw => highways.add(hw));
      }
    });
    
    // Convert major cities to waypoints (limit to avoid too many)
    const cityArray = Array.from(majorCities).slice(0, 8); // Limit to 8 waypoints
    cityArray.forEach(city => {
      // Skip if it's already start or end point
      const isStart = result.startPoint?.address?.toUpperCase().includes(city);
      const isEnd = result.endPoint?.address?.toUpperCase().includes(city);
      
      if (!isStart && !isEnd) {
        result.waypoints.push({
          address: `${city}, MO`, // Assume Missouri since it's a MO permit
          description: 'Route waypoint'
        });
      }
    });
    
    // If we didn't get border start/end, try traditional city extraction
    if (!result.startPoint || !result.endPoint) {
      const cityMatches = [...text.matchAll(patterns.city)];
      const cities = cityMatches.map(match => match[1].trim()).filter(city => city.length > 2);
      
      if (cities.length >= 2) {
        if (!result.startPoint) {
          result.startPoint = {
            address: `${cities[0]}, MO`,
            description: 'Start point'
          };
        }
        if (!result.endPoint) {
          result.endPoint = {
            address: `${cities[cities.length - 1]}, MO`,
            description: 'End point'
          };
        }
        
        // Add intermediate cities as waypoints if we don't have many
        if (result.waypoints.length < 3) {
          for (let i = 1; i < cities.length - 1; i++) {
            result.waypoints.push({
              address: `${cities[i]}, MO`,
              description: 'Waypoint'
            });
          }
        }
      }
    }
    
    // Extract highways for route info
    const allHighways = Array.from(highways);
    if (allHighways.length > 0) {
      result.routeInfo = {
        highways: allHighways,
        description: `Route includes highways: ${allHighways.join(', ')}`
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
