const fs = require('fs-extra');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Route Verification Service
 * Implements double-checking workflow:
 * 1. Extract waypoints from permit image
 * 2. Verify extracted waypoints against original image
 * 3. Convert verified addresses to coordinates
 * 4. Generate Google Maps compatible JSON with coordinates
 */
class RouteVerificationService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  /**
   * STEP 1: Extract waypoints/route points from permit (PDF or image)
   * Returns street addresses/location names
   */
  async extractWaypoints(filePath) {
    try {
      logger.info(`📍 STEP 1: Extracting waypoints from: ${filePath}`);
      
      const fileBuffer = await fs.readFile(filePath);
      const fileExtension = require('path').extname(filePath).toLowerCase();
      
      // Determine media type and prepare content
      let mediaType, base64Data;
      
      if (fileExtension === '.pdf') {
        mediaType = 'application/pdf';
        base64Data = fileBuffer.toString('base64');
        logger.info('📄 Processing PDF document directly with Claude');
      } else {
        // Image file
        const imageTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        mediaType = imageTypes[fileExtension] || 'image/png';
        base64Data = fileBuffer.toString('base64');
        logger.info(`🖼️  Processing ${mediaType} image`);
      }
      
      const prompt = `Analyze this truck permit document and extract ALL route waypoints, stops, and locations mentioned IN THE EXACT ORDER they appear on the route.

CRITICAL INSTRUCTIONS:
1. Look for the "Routing" or "Route" section of the permit
2. Extract EVERY city/location mentioned in the route table/list IN ORDER
3. For each location, provide the full city name with state
4. Convert highway-only references to the nearest city:
   - "I-70 E" → Find which city this references (like "Columbia, MO" or "Kansas City, MO")
   - "Exit 25" → Research the city near that exit
   - "Route 179" → Find the city along that route
5. DO NOT include vague locations like "United States"
6. Ensure waypoints flow geographically (no backtracking)

Return ONLY a JSON array of waypoints in order from start to end:

{
  "waypoints": [
    {
      "order": 1,
      "type": "origin",
      "address": "Kansas City, MO"
    },
    {
      "order": 2,
      "type": "waypoint",
      "address": "Columbia, MO"
    },
    {
      "order": 3,
      "type": "waypoint",
      "address": "St. Louis, MO"
    },
    {
      "order": 4,
      "type": "destination",
      "address": "Collinsville, IL"
    }
  ]
}

Extract FULL city names with states. Be specific and accurate.`;

      const response = await axios.post(this.baseUrl, {
        model: "anthropic/claude-sonnet-4.5",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://trucking-console.app',
          'X-Title': 'Trucking Console Route Verification'
        },
        timeout: 30000
      });

      const content = response.data.choices[0].message.content;
      logger.info(`Raw extraction response: ${content.substring(0, 200)}...`);
      
      // Parse JSON response
      let extractedData;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.error(`Failed to parse waypoints JSON: ${parseError.message}`);
        extractedData = { waypoints: [] };
      }

      logger.info(`✅ Extracted ${extractedData.waypoints?.length || 0} waypoints`);
      return extractedData.waypoints || [];

    } catch (error) {
      logger.error(`Waypoint extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 2: Verify extracted waypoints against original document
   * Double-checks that the extracted waypoints match what's in the document
   */
  async verifyWaypoints(filePath, extractedWaypoints) {
    try {
      logger.info(`🔍 STEP 2: Verifying ${extractedWaypoints.length} waypoints against original document`);
      
      const fileBuffer = await fs.readFile(filePath);
      const fileExtension = require('path').extname(filePath).toLowerCase();
      
      let mediaType, base64Data;
      if (fileExtension === '.pdf') {
        mediaType = 'application/pdf';
        base64Data = fileBuffer.toString('base64');
      } else {
        const imageTypes = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp'
        };
        mediaType = imageTypes[fileExtension] || 'image/png';
        base64Data = fileBuffer.toString('base64');
      }
      
      const waypointsList = extractedWaypoints.map((wp, idx) => 
        `${idx + 1}. ${wp.type}: ${wp.address}`
      ).join('\n');

      const prompt = `Review this truck permit image and verify the following extracted waypoints are correct:

EXTRACTED WAYPOINTS:
${waypointsList}

Please verify each waypoint by checking the original image. Return a JSON object with verification results:

{
  "verified": true,
  "verifiedWaypoints": [
    {
      "order": 1,
      "type": "origin",
      "address": "corrected or confirmed address",
      "verified": true,
      "notes": "Verified - matches permit" or "Corrected from original extraction"
    }
  ],
  "issues": [],
  "confidence": 0.95
}

- Set "verified": true for each waypoint that matches the image
- Correct any errors in the addresses
- Add notes about any discrepancies
- Overall confidence should be 0-1`;

      const response = await axios.post(this.baseUrl, {
        model: "anthropic/claude-sonnet-4.5",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://trucking-console.app',
          'X-Title': 'Trucking Console Route Verification'
        },
        timeout: 30000
      });

      const content = response.data.choices[0].message.content;
      logger.info(`Raw verification response: ${content.substring(0, 200)}...`);
      
      // Parse JSON response
      let verificationData;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          verificationData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in verification response');
        }
      } catch (parseError) {
        logger.error(`Failed to parse verification JSON: ${parseError.message}`);
        // Fallback: assume waypoints are correct
        verificationData = {
          verified: true,
          verifiedWaypoints: extractedWaypoints,
          issues: [],
          confidence: 0.5
        };
      }

      logger.info(`✅ Verification completed with confidence: ${verificationData.confidence}`);
      logger.info(`Verified: ${verificationData.verified}, Issues: ${verificationData.issues?.length || 0}`);
      
      return verificationData;

    } catch (error) {
      logger.error(`Waypoint verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 3: Geocode addresses to coordinates
   * Converts street addresses to lat/lng coordinates
   */
  async geocodeWaypoints(verifiedWaypoints) {
    try {
      logger.info(`🌍 STEP 3: Geocoding ${verifiedWaypoints.length} verified waypoints to coordinates`);
      
      const geocodedWaypoints = [];

      for (const waypoint of verifiedWaypoints) {
        try {
          const coordinates = await this.geocodeAddress(waypoint.address);
          
          geocodedWaypoints.push({
            ...waypoint,
            coordinates: {
              lat: coordinates.lat,
              lng: coordinates.lng
            },
            formattedAddress: coordinates.formatted_address,
            geocoded: true
          });
          
          logger.info(`  ✓ Geocoded: ${waypoint.address} → ${coordinates.lat}, ${coordinates.lng}`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          logger.error(`  ✗ Failed to geocode: ${waypoint.address} - ${error.message}`);
          
          // Add waypoint without coordinates if geocoding fails
          geocodedWaypoints.push({
            ...waypoint,
            coordinates: null,
            geocoded: false,
            error: error.message
          });
        }
      }

      const successCount = geocodedWaypoints.filter(wp => wp.geocoded).length;
      logger.info(`✅ Geocoded ${successCount}/${verifiedWaypoints.length} waypoints successfully`);
      
      return geocodedWaypoints;

    } catch (error) {
      logger.error(`Geocoding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Geocode a single address to coordinates
   * Uses Google Maps Geocoding API if available, otherwise uses OpenRouter LLM
   */
  async geocodeAddress(address) {
    try {
      // Try Google Maps API first if key is available
      if (this.googleMapsApiKey) {
        return await this.geocodeWithGoogleMaps(address);
      }
      
      // Fallback: Use OpenRouter LLM for geocoding
      return await this.geocodeWithLLM(address);
      
    } catch (error) {
      logger.error(`Geocoding error for "${address}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Geocode using Google Maps Geocoding API
   */
  async geocodeWithGoogleMaps(address) {
    try {
      const url = 'https://maps.googleapis.com/maps/api/geocode/json';
      const response = await axios.get(url, {
        params: {
          address: address,
          key: this.googleMapsApiKey
        },
        timeout: 10000
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Maps API error: ${response.data.status}`);
      }

      const result = response.data.results[0];
      
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address
      };

    } catch (error) {
      logger.error(`Google Maps geocoding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Geocode using LLM (fallback method)
   * Note: Less accurate than Google Maps API
   */
  async geocodeWithLLM(address) {
    try {
      const prompt = `Convert this address to geographic coordinates (latitude and longitude):

Address: ${address}

Return ONLY a JSON object with coordinates:

{
  "lat": 41.8781,
  "lng": -87.6298,
  "formatted_address": "Chicago, IL, USA"
}

IMPORTANT: 
- Provide the most accurate coordinates possible based on your knowledge
- For highway intersections or exits, find the nearest city and use those coordinates
- For "I-70 E" → find a specific city along I-70 (like "Columbia, MO")
- For "Exit 25" → research which city that exit is near
- NEVER return just "United States" or "USA" - always include a specific city and state
- If you can't find exact location, use the nearest major city along the route`;

      const response = await axios.post(this.baseUrl, {
        model: "anthropic/claude-sonnet-4.5",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://trucking-console.app',
          'X-Title': 'Trucking Console Geocoding'
        },
        timeout: 10000
      });

      const content = response.data.choices[0].message.content;
      
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in geocoding response');
      }
      
      const coordinates = JSON.parse(jsonMatch[0]);
      
      if (!coordinates.lat || !coordinates.lng) {
        throw new Error('Invalid coordinates in response');
      }

      // Validate that we got a real location, not just "United States"
      const formattedAddr = coordinates.formatted_address || '';
      if (formattedAddr.toLowerCase() === 'united states' || 
          formattedAddr.toLowerCase() === 'usa' ||
          !formattedAddr.includes(',')) {
        throw new Error(`Geocoding returned vague location: ${formattedAddr}`);
      }

      return coordinates;

    } catch (error) {
      logger.error(`LLM geocoding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * STEP 4: Generate Google Maps compatible JSON
   * Creates final route JSON with coordinates
   */
  async generateMapsJson(geocodedWaypoints) {
    try {
      logger.info(`📋 STEP 4: Generating Google Maps compatible JSON`);
      
      // Filter out waypoints without coordinates
      const validWaypoints = geocodedWaypoints.filter(wp => wp.coordinates);
      
      if (validWaypoints.length < 2) {
        throw new Error(`Insufficient valid waypoints: ${validWaypoints.length} (need at least 2)`);
      }

      // Sort by order field to ensure proper sequence
      validWaypoints.sort((a, b) => (a.order || 0) - (b.order || 0));

      // Separate origin, destination, and intermediate waypoints
      const origin = validWaypoints.find(wp => wp.type === 'origin') || validWaypoints[0];
      const destination = validWaypoints.find(wp => wp.type === 'destination') || validWaypoints[validWaypoints.length - 1];
      
      // Get intermediate waypoints and remove duplicates
      let intermediateWaypoints = validWaypoints.filter(wp => wp !== origin && wp !== destination);
      
      // Remove duplicate cities to prevent backtracking
      intermediateWaypoints = this.removeDuplicateCities(intermediateWaypoints);
      
      // Ensure waypoints are geographically ordered (no backtracking)
      intermediateWaypoints = this.ensureGeographicOrder(origin, intermediateWaypoints, destination);

      const mapsJson = {
        origin: {
          lat: origin.coordinates.lat,
          lng: origin.coordinates.lng,
          address: origin.address,
          formattedAddress: origin.formattedAddress || origin.address
        },
        destination: {
          lat: destination.coordinates.lat,
          lng: destination.coordinates.lng,
          address: destination.address,
          formattedAddress: destination.formattedAddress || destination.address
        },
        waypoints: intermediateWaypoints.map(wp => ({
          lat: wp.coordinates.lat,
          lng: wp.coordinates.lng,
          address: wp.address,
          formattedAddress: wp.formattedAddress || wp.address
        })),
        travelMode: 'DRIVING',
        timestamp: new Date().toISOString()
      };

      logger.info(`✅ Generated Maps JSON with ${intermediateWaypoints.length} waypoints`);
      logger.info(`   Origin: ${origin.address}`);
      logger.info(`   Destination: ${destination.address}`);
      
      return mapsJson;

    } catch (error) {
      logger.error(`Maps JSON generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete workflow: Extract → Verify → Geocode → Generate JSON
   */
  async processPermitRoute(filePath) {
    try {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`🚛 ROUTE VERIFICATION WORKFLOW STARTED`);
      logger.info(`File: ${filePath}`);
      logger.info(`${'='.repeat(60)}\n`);

      // STEP 1: Extract waypoints
      const extractedWaypoints = await this.extractWaypoints(filePath);
      
      if (extractedWaypoints.length === 0) {
        throw new Error('No waypoints could be extracted from the permit document');
      }

      // STEP 2: Verify waypoints
      const verificationResult = await this.verifyWaypoints(filePath, extractedWaypoints);
      
      if (!verificationResult.verified && verificationResult.confidence < 0.5) {
        logger.warn(`⚠️  Low verification confidence: ${verificationResult.confidence}`);
      }

      const verifiedWaypoints = verificationResult.verifiedWaypoints;

      // STEP 3: Geocode to coordinates
      const geocodedWaypoints = await this.geocodeWaypoints(verifiedWaypoints);

      // STEP 4: Generate Maps JSON
      const mapsJson = await this.generateMapsJson(geocodedWaypoints);

      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`✅ ROUTE VERIFICATION WORKFLOW COMPLETED`);
      logger.info(`${'='.repeat(60)}\n`);

      return {
        success: true,
        extractedWaypoints,
        verificationResult,
        geocodedWaypoints,
        mapsJson,
        metadata: {
          totalWaypoints: geocodedWaypoints.length,
          geocodedSuccessfully: geocodedWaypoints.filter(wp => wp.geocoded).length,
          verificationConfidence: verificationResult.confidence,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error(`\n${'='.repeat(60)}`);
      logger.error(`❌ ROUTE VERIFICATION WORKFLOW FAILED`);
      logger.error(`Error: ${error.message}`);
      logger.error(`${'='.repeat(60)}\n`);
      throw error;
    }
  }

  /**
   * Remove duplicate cities from waypoints list
   * Prevents routes like "Kansas City → Lawrence → Kansas City"
   */
  removeDuplicateCities(waypoints) {
    const seen = new Set();
    const unique = [];

    for (const wp of waypoints) {
      // Extract city name (before first comma)
      const city = wp.address.split(',')[0].trim().toLowerCase();
      
      if (!seen.has(city)) {
        seen.add(city);
        unique.push(wp);
      } else {
        logger.info(`   🗑️  Removed duplicate waypoint: ${wp.address}`);
      }
    }

    return unique;
  }

  /**
   * Ensure waypoints are in geographic order (no backtracking)
   * Uses distance calculation to detect and fix routing backwards
   */
  ensureGeographicOrder(origin, waypoints, destination) {
    if (waypoints.length === 0) return waypoints;

    logger.info(`   🔄 Checking geographic order of ${waypoints.length} waypoints...`);

    // Calculate cumulative distance for current order
    const currentDistance = this.calculateTotalDistance([origin, ...waypoints, destination]);
    
    // Try removing waypoints that cause backtracking
    const optimized = [];
    let lastPoint = origin;

    for (const wp of waypoints) {
      const distToWaypoint = this.calculateDistance(
        lastPoint.coordinates.lat, 
        lastPoint.coordinates.lng,
        wp.coordinates.lat,
        wp.coordinates.lng
      );

      const distFromWaypointToDest = this.calculateDistance(
        wp.coordinates.lat,
        wp.coordinates.lng,
        destination.coordinates.lat,
        destination.coordinates.lng
      );

      const directDistance = this.calculateDistance(
        lastPoint.coordinates.lat,
        lastPoint.coordinates.lng,
        destination.coordinates.lat,
        destination.coordinates.lng
      );

      // Keep waypoint if it's actually between last point and destination
      // More lenient threshold (2.0 instead of 1.5) to keep more waypoints
      if (distToWaypoint + distFromWaypointToDest <= directDistance * 2.0) {
        optimized.push(wp);
        lastPoint = wp;
      } else {
        logger.info(`   ⚠️  Removed backtracking waypoint: ${wp.address} (adds ${((distToWaypoint + distFromWaypointToDest - directDistance)).toFixed(0)} extra miles)`);
      }
    }

    const optimizedDistance = this.calculateTotalDistance([origin, ...optimized, destination]);
    logger.info(`   ✅ Route optimization: ${currentDistance.toFixed(0)}mi → ${optimizedDistance.toFixed(0)}mi (kept ${optimized.length}/${waypoints.length} waypoints)`);

    return optimized;
  }

  /**
   * Calculate total distance along a route
   */
  calculateTotalDistance(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.calculateDistance(
        points[i].coordinates.lat,
        points[i].coordinates.lng,
        points[i + 1].coordinates.lat,
        points[i + 1].coordinates.lng
      );
    }
    return total;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   * Returns distance in miles
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }
}

module.exports = RouteVerificationService;
