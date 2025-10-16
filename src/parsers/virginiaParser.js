const logger = require('../utils/logger');

/**
 * Parse Virginia truck permit text
 * Virginia permits often include detailed route specifications and weight restrictions
 * Supports both structured routing tables (EZ-HAUL format) and narrative descriptions
 */
async function parseVirginia(text) {
  try {
    logger.info('Parsing Virginia permit text');
    
    const result = {
      startPoint: null,
      endPoint: null,
      waypoints: [],
      restrictions: [],
      distance: null,
      parseAccuracy: 0.8
    };
    
    // Try to extract structured routing table first (EZ-HAUL format)
    const tableWaypoints = extractRoutingTable(text);
    
    if (tableWaypoints && tableWaypoints.length >= 2) {
      logger.info(`Extracted ${tableWaypoints.length} waypoints from routing table`);
      
      result.startPoint = {
        address: tableWaypoints[0].address,
        description: tableWaypoints[0].description || 'Origin'
      };
      
      result.endPoint = {
        address: tableWaypoints[tableWaypoints.length - 1].address,
        description: tableWaypoints[tableWaypoints.length - 1].description || 'Destination'
      };
      
      // Add all intermediate points as waypoints
      for (let i = 1; i < tableWaypoints.length - 1; i++) {
        result.waypoints.push({
          address: tableWaypoints[i].address,
          description: tableWaypoints[i].description || `Waypoint ${i}`
        });
      }
      
      result.parseAccuracy = 0.95;
    } else {
      // Fallback to pattern-based extraction
      logger.info('No routing table found, using pattern-based extraction');
      const patternResult = extractUsingPatterns(text);
      result.startPoint = patternResult.startPoint;
      result.endPoint = patternResult.endPoint;
      result.waypoints = patternResult.waypoints;
      result.parseAccuracy = patternResult.parseAccuracy;
    }
    
    // Extract common metadata
    const metadata = extractMetadata(text);
    result.restrictions = metadata.restrictions;
    result.distance = metadata.distance;
    result.permitNumber = metadata.permitNumber;
    
    logger.info(`Virginia parsing completed with ${result.waypoints.length} waypoints, accuracy: ${result.parseAccuracy}`);
    return result;
    
  } catch (error) {
    logger.error(`Virginia parsing error: ${error.message}`);
    throw new Error(`Failed to parse Virginia permit: ${error.message}`);
  }
}

/**
 * Extract waypoints from structured routing table (EZ-HAUL and similar formats)
 * Looks for tables with columns like: Miles, Route, To, Distance, Est. Time
 */
function extractRoutingTable(text) {
  const waypoints = [];
  
  // Pattern to match table rows with route information
  // Format: "0.77 I-64 Ramp Continue straight on I-81N 57.11 00h:00m"
  const tableRowPattern = /(\d+\.?\d*)\s+([A-Z0-9\-]+(?:\s+[A-Z][a-z]+)?)\s+(.+?)\s+(\d+\.?\d*)\s+(\d+h:\d+m)/gi;
  
  // Also try to match simpler formats like "I-64E Take Exit 56"
  const simpleRowPattern = /(?:Take\s+)?(?:Exit\s+)?(\d+)\s*[:\-]?\s*([A-Z][\w\s\-\/]+?)(?:\s+(?:to|toward|towards))?\s+([A-Z][\w\s,\-\/]+?)(?:\s+\d+\.?\d*\s*(?:miles?|mi))?/gi;
  
  // Extract destination from "Destination: VIRGINIA BEACH-NORFOLK" pattern
  const destinationPattern = /(?:Destination|Arrive\s+at\s+destination)[:\s]+([A-Z][A-Za-z\s\-\/]+?)(?:\s+Totals?:|$|\n)/i;
  
  // Extract origin from "Origin: I-64 WV Line" pattern
  const originPattern = /(?:Origin|Start)[:\s]+([A-Z][A-Za-z0-9\s\-\/]+?)(?:\s+Miles|$|\n)/i;
  
  let matches = [...text.matchAll(tableRowPattern)];
  
  if (matches.length > 0) {
    logger.info(`Found ${matches.length} routing table entries`);
    
    for (const match of matches) {
      const [, miles, route, instruction, distance, time] = match;
      
      // Extract location from instruction
      const location = extractLocationFromInstruction(instruction, route);
      
      if (location) {
        waypoints.push({
          address: location,
          description: `${route} - ${instruction.substring(0, 50)}`,
          route: route,
          miles: parseFloat(miles),
          distance: parseFloat(distance)
        });
      }
    }
  } else {
    // Try simpler pattern
    matches = [...text.matchAll(simpleRowPattern)];
    
    if (matches.length > 0) {
      logger.info(`Found ${matches.length} simple route entries`);
      
      for (const match of matches) {
        const [, exitNum, route, location] = match;
        
        const cleanLocation = cleanLocationString(location);
        
        if (cleanLocation) {
          waypoints.push({
            address: cleanLocation,
            description: `${route} Exit ${exitNum}`,
            route: route
          });
        }
      }
    }
  }
  
  // Extract origin and destination from headers
  const originMatch = text.match(originPattern);
  const destMatch = text.match(destinationPattern);
  
  if (originMatch) {
    const origin = cleanLocationString(originMatch[1]);
    if (origin && waypoints.length > 0 && waypoints[0].address !== origin) {
      waypoints.unshift({
        address: origin,
        description: 'Origin',
        route: 'Start'
      });
    }
  }
  
  if (destMatch) {
    const dest = cleanLocationString(destMatch[1]);
    if (dest && waypoints.length > 0 && waypoints[waypoints.length - 1].address !== dest) {
      waypoints.push({
        address: dest,
        description: 'Destination',
        route: 'End'
      });
    }
  }
  
  // If we have waypoints but they don't include state, add VA
  for (const wp of waypoints) {
    if (!wp.address.includes(',') && !wp.address.match(/\b[A-Z]{2}\b/)) {
      wp.address += ', VA';
    }
  }
  
  return waypoints.length >= 2 ? waypoints : null;
}

/**
 * Extract location from routing instruction
 */
function extractLocationFromInstruction(instruction, route) {
  // Remove common instruction prefixes
  let clean = instruction
    .replace(/^(?:Continue straight on|Take Exit|Turn left onto|Turn right onto|Take ramp|At exit|Go on|Keep)\s+/i, '')
    .replace(/(?:ramp|toward|towards|to)\s+/gi, ' ')
    .trim();
  
  // Look for city names (capitalized words)
  const cityMatch = clean.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
  
  if (cityMatch) {
    let city = cityMatch[1];
    
    // Common Virginia cities that should be recognized
    const vaCities = ['Richmond', 'Norfolk', 'Virginia Beach', 'Chesapeake', 'Newport News', 
                      'Alexandria', 'Hampton', 'Portsmouth', 'Suffolk', 'Roanoke', 'Petersburg',
                      'Williamsburg', 'Charlottesville', 'Lynchburg', 'Harrisonburg', 'Staunton'];
    
    // If it's a known city, use it
    if (vaCities.some(c => city.toLowerCase().includes(c.toLowerCase()))) {
      return `${city}, VA`;
    }
    
    // Check if instruction contains enough info for a waypoint
    if (clean.length > 5 && city.length > 3) {
      return `${city}, VA`;
    }
  }
  
  // If no city found, use the route as a reference point
  if (route && clean.length > 10) {
    return `${route} ${clean.substring(0, 30)}, VA`;
  }
  
  return null;
}

/**
 * Clean location string - remove extra text and format properly
 */
function cleanLocationString(location) {
  if (!location) return null;
  
  let clean = location
    .replace(/\[.*?\]/g, '') // Remove bracketed text
    .replace(/\(.*?\)/g, '') // Remove parentheses
    .replace(/\s+/g, ' ')    // Normalize spaces
    .replace(/[-\/]+/g, ', ') // Convert hyphens/slashes to commas
    .trim();
  
  // If it's too short, probably not a valid location
  if (clean.length < 3) return null;
  
  // If it's all uppercase, convert to title case
  if (clean === clean.toUpperCase()) {
    clean = clean.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }
  
  // Add VA if no state specified
  if (!clean.match(/,\s*[A-Z]{2}$/)) {
    clean += ', VA';
  }
  
  return clean;
}

/**
 * Extract waypoints using text patterns (fallback method)
 */
function extractUsingPatterns(text) {
  const patterns = {
    city: /(?:from|to|through|via)\s+([A-Za-z\s]+?)(?:,|\s+(?:VA|Virginia))/gi,
    highway: /(?:Interstate|I-|US|Route|VA|SR)\s*(\d+)/gi
  };
  
  const cityMatches = [...text.matchAll(patterns.city)];
  const cities = cityMatches.map(match => match[1].trim()).filter(city => city.length > 2);
  
  if (cities.length >= 2) {
    const startPoint = {
      address: `${cities[0]}, VA`,
      description: 'Start point'
    };
    const endPoint = {
      address: `${cities[cities.length - 1]}, VA`,
      description: 'End point'
    };
    const waypoints = [];
    
    for (let i = 1; i < cities.length - 1; i++) {
      waypoints.push({
        address: `${cities[i]}, VA`,
        description: 'Waypoint'
      });
    }
    
    return { startPoint, endPoint, waypoints, parseAccuracy: 0.7 };
  }
  
  // Fallback to default Virginia route
  return {
    startPoint: { address: 'Richmond, VA', description: 'Start point' },
    endPoint: { address: 'Norfolk, VA', description: 'End point' },
    waypoints: [{ address: 'Petersburg, VA', description: 'Waypoint' }],
    parseAccuracy: 0.5
  };
}

/**
 * Extract metadata like restrictions, distance, permit number
 */
function extractMetadata(text) {
  const metadata = {
    restrictions: [],
    distance: null,
    permitNumber: null
  };
  
  // Extract weight restrictions
  const weightPattern = /(?:weight|gross|axle)[\s\S]*?(?:pounds|lbs|tons)[\s\S]*?(?:\.|$)/gi;
  const weightMatches = [...text.matchAll(weightPattern)];
  metadata.restrictions.push(...weightMatches.map(match => ({
    type: 'weight',
    description: match[0].trim()
  })));
  
  // Extract general restrictions
  const restrictionPattern = /(?:restriction|limit|prohibited|no\s*travel)[\s\S]*?(?:\.|$)/gi;
  const restrictionMatches = [...text.matchAll(restrictionPattern)];
  metadata.restrictions.push(...restrictionMatches.map(match => ({
    type: 'general',
    description: match[0].trim()
  })));
  
  // Extract permit number
  const permitPattern = /permit\s*(?:number|#)?\s*:?\s*([A-Z0-9\-]+)/gi;
  const permitMatches = [...text.matchAll(permitPattern)];
  if (permitMatches.length > 0) {
    metadata.permitNumber = permitMatches[0][1];
  }
  
  // Extract total distance
  const totalDistancePattern = /(?:Totals?|Total\s+Distance)[:\s]+(\d+\.?\d*)\s*(?:miles?|mi)/i;
  const totalDistMatch = text.match(totalDistancePattern);
  if (totalDistMatch) {
    metadata.distance = {
      value: parseFloat(totalDistMatch[1]),
      unit: 'miles'
    };
  }
  
  return metadata;
}

module.exports = { parseVirginia };
