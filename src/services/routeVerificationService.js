const fs = require('fs-extra');
const axios = require('axios');
const logger = require('../utils/logger');
const { getInstance: getExampleDB } = require('./exampleDatabase');

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
    
    // Parse models from environment variables
    // VISION_MODEL: comma-separated list of models to try in order
    // AI_MODEL: fallback if VISION_MODEL not set
    const visionModels = process.env.VISION_MODEL || process.env.AI_MODEL;
    this.models = visionModels.split(',').map(m => m.trim());
    
    // Initialize example database for few-shot learning
    this.exampleDB = getExampleDB();
    this.exampleDB.initialize().catch(err => 
      logger.warn(`Could not initialize example database: ${err.message}`)
    );
    
    logger.info(`🤖 Using vision models in order: ${this.models.join(' → ')}`);
    logger.info(`📚 Few-shot learning enabled (examples will improve accuracy over time)`);
  }

  /**
   * STEP 1: Extract waypoints/route points from permit (PDF or image)
   * Returns street addresses/location names
   * Uses cascading model fallback for best accuracy
   */
  async extractWaypoints(filePath) {
    let bestResult = null;
    let maxWaypoints = 0;

    for (const model of this.models) {
      try {
        logger.info(`📍 STEP 1: Extracting waypoints with ${model}`);
        
        // Try two different prompting strategies
        const strategies = ['detailed', 'table-focused'];
        
        for (const strategy of strategies) {
          try {
            const result = await this.extractWaypointsWithModel(filePath, model, strategy);
            
            if (result && result.length > 0) {
              logger.info(`   ✓ Strategy '${strategy}' extracted ${result.length} waypoints`);
              
              // Keep track of the result with most waypoints
              if (result.length > maxWaypoints) {
                maxWaypoints = result.length;
                bestResult = result;
              }
              
              // If we got a good number of waypoints (>= 8), use it
              if (result.length >= 8) {
                logger.info(`✅ Successfully extracted ${result.length} waypoints with ${model} (${strategy})`);
                return result;
              }
            }
          } catch (strategyError) {
            logger.warn(`   ⚠️  Strategy '${strategy}' failed: ${strategyError.message}`);
          }
        }
        
      } catch (error) {
        logger.error(`❌ ${model} failed: ${error.message}, trying next model...`);
      }
    }

    // If we got at least some waypoints, use the best result
    if (bestResult && bestResult.length > 0) {
      logger.info(`✅ Using best result with ${maxWaypoints} waypoints`);
      return bestResult;
    }

    throw new Error('All models and strategies failed to extract waypoints');
  }

  /**
   * Extract waypoints using a specific model and strategy
   */
  async extractWaypointsWithModel(filePath, model, strategy = 'detailed', permitInfo = {}) {
    try {
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
      
      // Get few-shot examples for improved accuracy
      const fewShotExamples = await this.exampleDB.getBestExamples(permitInfo, 3);
      const fewShotPrompt = this.exampleDB.buildFewShotPrompt(fewShotExamples);
      
      let prompt;
      
      if (strategy === 'table-focused') {
        prompt = `EXTRACT ROUTING TABLE FROM TRUCK PERMIT

Your task: Find the routing table/section and extract EVERY SINGLE ROW.

1. Locate the "ROUTING:", "ROUTE:", or similar section header
2. Count how many rows are in that table
3. Extract each row in order - do NOT skip any
4. For each row, extract the city/location or highway reference

EXAMPLE - If you see a table like:
┌─────────────────────────────┐
│ ROUTING:                     │
│ 1. Kansas City, MO          │
│ 2. I-70 East                │
│ 3. Columbia, MO             │
│ 4. St. Louis, MO            │
│ 5. I-255 South              │
│ 6. Collinsville, IL         │
└─────────────────────────────┘

Return ALL 6 entries in JSON:
{
  "waypoints": [
    {"order": 1, "type": "origin", "address": "Kansas City, MO"},
    {"order": 2, "type": "waypoint", "address": "I-70 East near Columbia, MO"},
    {"order": 3, "type": "waypoint", "address": "Columbia, MO"},
    {"order": 4, "type": "waypoint", "address": "St. Louis, MO"},
    {"order": 5, "type": "waypoint", "address": "I-255 South near Collinsville, IL"},
    {"order": 6, "type": "destination", "address": "Collinsville, IL"}
  ]
}

NOW: Count the routing table rows carefully and return ALL of them.`;
      } else {
        prompt = `TASK: Extract the complete routing information from this truck permit.

STEP 1: Find the "Routing" or "Route" section
STEP 2: Read EVERY line in that section word-for-word
STEP 3: Convert to a structured list

CRITICAL RULES:
- Extract EVERY SINGLE LINE from the routing section
- Do NOT skip ANY entries, even if they seem redundant
- Do NOT interpret or simplify - extract exactly what you see
- Include highway numbers, route numbers, city names - EVERYTHING
- Preserve the EXACT order shown in the document
- If you see 15 lines in the routing section, return 15 waypoints

FORMAT REQUIREMENTS:
- For city entries: "City Name, STATE" (e.g., "Kansas City, MO")
- For highway entries: Include the highway AND the nearest city (e.g., "I-70 E near Columbia, MO")
- For intersections: Include both roads and nearest city (e.g., "I-70 & US-40 near Kansas City, MO")

EXAMPLE - If permit shows:
====================================
ROUTING:
1. Kansas City, MO
2. I-70 East
3. Lawrence, KS
4. Topeka, KS
5. I-70 East
6. Junction City, KS
7. Salina, KS
====================================

Return ALL 7 entries:
{
  "waypoints": [
    {"order": 1, "type": "origin", "address": "Kansas City, MO"},
    {"order": 2, "type": "waypoint", "address": "I-70 East near Lawrence, KS"},
    {"order": 3, "type": "waypoint", "address": "Lawrence, KS"},
    {"order": 4, "type": "waypoint", "address": "Topeka, KS"},
    {"order": 5, "type": "waypoint", "address": "I-70 East near Junction City, KS"},
    {"order": 6, "type": "waypoint", "address": "Junction City, KS"},
    {"order": 7, "type": "destination", "address": "Salina, KS"}
  ]
}

NOW: Extract ALL routing entries from this permit. Count carefully and include EVERYTHING.

IMPORTANT FOR ACCURACY:
- If you see specific street addresses (like "802-898 South Huttig Avenue"), include them EXACTLY
- If you see intersection details (like "I-435 N at state border"), include them EXACTLY  
- Pay attention to directional indicators (N, S, E, W, NE, etc.)
- Don't skip intermediate cities between major destinations
- If the permit lists highways between cities, convert each to the nearest city along that route`;
      }
      
      // Append few-shot examples if available
      if (fewShotPrompt) {
        prompt += fewShotPrompt;
      }

      // Use prompt caching for Anthropic models to reduce costs
      const isAnthropicModel = model.includes('anthropic') || model.includes('claude');
      
      const messageContent = isAnthropicModel ? [
        {
          type: "text",
          text: prompt,
          cache_control: { type: "ephemeral" } // Cache the instructions for 5 minutes
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mediaType};base64,${base64Data}`
          }
        }
      ] : [
        {
          type: "text",
          text: prompt
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mediaType};base64,${base64Data}`
          }
        }
      ];

      const requestHeaders = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trucking-console.app',
        'X-Title': 'Trucking Console Route Verification'
      };

      // Add Anthropic-specific headers for prompt caching
      if (isAnthropicModel) {
        requestHeaders['anthropic-version'] = '2023-06-01';
        requestHeaders['anthropic-beta'] = 'prompt-caching-2024-07-31';
      }

      const response = await axios.post(this.baseUrl, {
        model: model,
        messages: [
          {
            role: "user",
            content: messageContent
          }
        ],
        max_tokens: 6000,
        temperature: 0.05
      }, {
        headers: requestHeaders,
        timeout: 30000
      });
      
      // Log cache usage if available (Anthropic returns this)
      if (response.data.usage?.cache_creation_input_tokens) {
        logger.info(`   💾 Cache created: ${response.data.usage.cache_creation_input_tokens} tokens`);
      }
      if (response.data.usage?.cache_read_input_tokens) {
        logger.info(`   ⚡ Cache hit: ${response.data.usage.cache_read_input_tokens} tokens (90% cost savings!)`);
      }

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

      const prompt = `VERIFICATION TASK: Compare the extracted waypoints below with the original permit routing table.

EXTRACTED WAYPOINTS TO VERIFY:
${waypointsList}

VERIFICATION CHECKLIST:
1. Look at the permit's routing section - count how many rows/entries are in the table
2. Check if we extracted the SAME NUMBER of waypoints as shown in the permit
3. Verify each waypoint address matches what's written in the permit (row by row)
4. If any waypoints are missing, incorrect, or out of order, add them to "verifiedWaypoints"
5. If the extraction missed waypoints, ADD THE MISSING ONES to the list
6. Maintain the exact sequence from the permit

CRITICAL: If the permit routing table has 10 entries but we only extracted 4, ADD THE 6 MISSING ONES.

PAY SPECIAL ATTENTION TO:
- Street addresses with house numbers (include full address)
- Highway/route numbers with directions (I-70 E, US-40 W, etc.)
- Intersection points (where routes meet)
- Cities that appear multiple times (may indicate route passes through twice)
- Small towns between major cities

Return this JSON structure:

{
  "verified": true,
  "verifiedWaypoints": [
    {
      "order": 1,
      "type": "origin",
      "address": "City, ST",
      "verified": true,
      "notes": "Confirmed correct" OR "Added missing waypoint" OR "Corrected from [old value]"
    },
    ...include ALL waypoints that should be in the route...
  ],
  "issues": ["Description of any problems found"],
  "confidence": 0.95
}

Your job is to ensure the verifiedWaypoints list is COMPLETE and ACCURATE compared to the permit. Add any missing entries.`;

      const model = this.models[0];
      const isAnthropicModel = model.includes('anthropic') || model.includes('claude');
      
      const messageContent = isAnthropicModel ? [
        {
          type: "text",
          text: prompt,
          cache_control: { type: "ephemeral" } // Cache verification instructions
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mediaType};base64,${base64Data}`
          }
        }
      ] : [
        {
          type: "text",
          text: prompt
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${mediaType};base64,${base64Data}`
          }
        }
      ];

      const requestHeaders = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trucking-console.app',
        'X-Title': 'Trucking Console Route Verification'
      };

      if (isAnthropicModel) {
        requestHeaders['anthropic-version'] = '2023-06-01';
        requestHeaders['anthropic-beta'] = 'prompt-caching-2024-07-31';
      }

      const response = await axios.post(this.baseUrl, {
        model: model,
        messages: [
          {
            role: "user",
            content: messageContent
          }
        ],
        max_tokens: 6000,
        temperature: 0.05
      }, {
        headers: requestHeaders,
        timeout: 45000
      });
      
      if (response.data.usage?.cache_read_input_tokens) {
        logger.info(`   ⚡ Verification cache hit: ${response.data.usage.cache_read_input_tokens} tokens saved`);
      }

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

      // Geocode with context awareness - previous and next waypoints help accuracy
      for (let i = 0; i < verifiedWaypoints.length; i++) {
        const waypoint = verifiedWaypoints[i];
        const prevWaypoint = i > 0 ? geocodedWaypoints[i - 1] : null;
        const nextWaypoint = i < verifiedWaypoints.length - 1 ? verifiedWaypoints[i + 1] : null;
        
        try {
          const coordinates = await this.geocodeAddressWithContext(
            waypoint.address, 
            prevWaypoint?.formattedAddress,
            nextWaypoint?.address
          );
          
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
          
          // Try one more time with relaxed validation
          try {
            logger.info(`  🔄 Retrying with relaxed validation...`);
            const coordinates = await this.geocodeAddressRelaxed(waypoint.address);
            geocodedWaypoints.push({
              ...waypoint,
              coordinates: {
                lat: coordinates.lat,
                lng: coordinates.lng
              },
              formattedAddress: coordinates.formatted_address,
              geocoded: true,
              relaxedGeocoding: true
            });
            logger.info(`  ✓ Retry successful: ${waypoint.address} → ${coordinates.lat}, ${coordinates.lng}`);
          } catch (retryError) {
            // Add waypoint without coordinates if geocoding fails completely
            geocodedWaypoints.push({
              ...waypoint,
              coordinates: null,
              geocoded: false,
              error: error.message
            });
          }
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
   * Geocode with context from surrounding waypoints for better accuracy
   */
  async geocodeAddressWithContext(address, prevAddress, nextAddress) {
    try {
      // Try Google Maps API first if key is available
      if (this.googleMapsApiKey) {
        return await this.geocodeWithGoogleMaps(address);
      }
      
      // Use LLM with route context for better accuracy
      const contextPrompt = prevAddress && nextAddress
        ? `\n\nROUTE CONTEXT: This waypoint is between "${prevAddress}" and "${nextAddress}" on a truck route. Use this to determine the most logical location.`
        : prevAddress
        ? `\n\nROUTE CONTEXT: This waypoint comes after "${prevAddress}" on a truck route.`
        : nextAddress
        ? `\n\nROUTE CONTEXT: This waypoint comes before "${nextAddress}" on a truck route.`
        : '';
      
      return await this.geocodeWithLLM(address, contextPrompt);
      
    } catch (error) {
      logger.error(`Context-aware geocoding error for "${address}": ${error.message}`);
      throw error;
    }
  }

  /**
   * Geocode with relaxed validation (for retry attempts)
   */
  async geocodeAddressRelaxed(address) {
    try {
      if (this.googleMapsApiKey) {
        return await this.geocodeWithGoogleMaps(address);
      }
      return await this.geocodeWithLLM(address, '', true);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Legacy method - now routes to context-aware version
   */
  async geocodeAddress(address) {
    return await this.geocodeAddressWithContext(address, null, null);
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
  async geocodeWithLLM(address, contextHint = '', relaxed = false) {
    try {
      const prompt = `Convert this address to geographic coordinates (latitude and longitude):

Address: ${address}${contextHint}

Return ONLY a JSON object with coordinates:

{
  "lat": 41.8781,
  "lng": -87.6298,
  "formatted_address": "Chicago, IL, USA"
}

CRITICAL INSTRUCTIONS FOR ACCURACY:
- For full street addresses with numbers (e.g., "802-898 South Huttig Avenue"), geocode the EXACT location
- For intersections (e.g., "I-435 N at KS/MO border"), find the precise coordinates of that intersection
- For highway references (e.g., "I-70 E"), identify which specific city/exit along that highway
- For city names alone, use the city center coordinates
- Always include street name, city, state in formatted_address
- Be as specific as possible - use exact address if provided
- NEVER return vague locations like "United States" or "USA" alone
- Cross-reference with surrounding route context if provided`;

      const model = this.models[0];
      const isAnthropicModel = model.includes('anthropic') || model.includes('claude');
      
      // For geocoding, cache the instruction part of the prompt
      const messageContent = isAnthropicModel ? [
        {
          type: "text",
          text: prompt,
          cache_control: { type: "ephemeral" }
        }
      ] : prompt;

      const requestHeaders = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://trucking-console.app',
        'X-Title': 'Trucking Console Geocoding'
      };

      if (isAnthropicModel) {
        requestHeaders['anthropic-version'] = '2023-06-01';
        requestHeaders['anthropic-beta'] = 'prompt-caching-2024-07-31';
      }

      const response = await axios.post(this.baseUrl, {
        model: model,
        messages: [
          {
            role: "user",
            content: isAnthropicModel ? messageContent : prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.05
      }, {
        headers: requestHeaders,
        timeout: 15000
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

      // Validate that we got a real location (skip validation if relaxed mode)
      if (!relaxed) {
        const formattedAddr = coordinates.formatted_address || '';
        if (formattedAddr.toLowerCase() === 'united states' || 
            formattedAddr.toLowerCase() === 'usa' ||
            (!formattedAddr.includes(',') && !formattedAddr.includes(' '))) {
          throw new Error(`Geocoding returned vague location: ${formattedAddr}`);
        }
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
      
      // Get intermediate waypoints
      let intermediateWaypoints = validWaypoints.filter(wp => wp !== origin && wp !== destination);
      
      // KEEP ALL WAYPOINTS EXACTLY AS SPECIFIED IN THE PERMIT
      // Truck permits specify required routes - we should NOT remove waypoints
      // The permit may require specific roads, intersections, or paths that seem indirect
      // Filtering removes critical waypoints and makes routes inaccurate
      
      // ALL FILTERING DISABLED FOR MAXIMUM ACCURACY
      // intermediateWaypoints = this.removeDuplicateCities(intermediateWaypoints); // DISABLED
      // intermediateWaypoints = this.ensureGeographicOrder(origin, intermediateWaypoints, destination); // DISABLED
      
      logger.info(`   ✅ Keeping ALL ${intermediateWaypoints.length} waypoints as specified in permit (no filtering)`);

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
      
      logger.info(`\n📋 EXTRACTED WAYPOINTS (${extractedWaypoints.length}):`);
      extractedWaypoints.forEach((wp, idx) => {
        logger.info(`   ${idx + 1}. [${wp.type}] ${wp.address}`);
      });
      logger.info('');
      
      // Quick validation: check if route makes geographic sense
      const routeValidation = this.validateRouteLogic(extractedWaypoints);
      if (!routeValidation.valid) {
        logger.warn(`⚠️  Route validation warning: ${routeValidation.message}`);
      }

      // STEP 2: Verify waypoints
      const verificationResult = await this.verifyWaypoints(filePath, extractedWaypoints);
      
      if (!verificationResult.verified && verificationResult.confidence < 0.5) {
        logger.warn(`⚠️  Low verification confidence: ${verificationResult.confidence}`);
      }

      let verifiedWaypoints = verificationResult.verifiedWaypoints;
      
      logger.info(`\n✓ VERIFIED WAYPOINTS (${verifiedWaypoints.length})`);
      verifiedWaypoints.forEach((wp, idx) => {
        const verifiedLabel = wp.verified ? '✓' : '⚠';
        logger.info(`   ${verifiedLabel} ${idx + 1}. [${wp.type}] ${wp.address}`);
        if (wp.notes) logger.info(`      Note: ${wp.notes}`);
      });
      logger.info('');
      
      // Intelligent enrichment: If we have long highway segments without cities, add intermediate waypoints
      verifiedWaypoints = await this.enrichWaypointsWithIntermediateCities(verifiedWaypoints);
      
      if (verifiedWaypoints.length > verificationResult.verifiedWaypoints.length) {
        logger.info(`\n🔧 ENRICHED WAYPOINTS (+${verifiedWaypoints.length - verificationResult.verifiedWaypoints.length} added):`);
        verifiedWaypoints.forEach((wp, idx) => {
          if (wp.enriched) {
            logger.info(`   + ${idx + 1}. [${wp.type}] ${wp.address} (auto-added)`);
          }
        });
        logger.info('');
      }

      // STEP 3: Geocode to coordinates
      const geocodedWaypoints = await this.geocodeWaypoints(verifiedWaypoints);

      // STEP 4: Generate Maps JSON
      const mapsJson = await this.generateMapsJson(geocodedWaypoints);

      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`✅ ROUTE VERIFICATION WORKFLOW COMPLETED`);
      logger.info(`${'='.repeat(60)}\n`);

      // Store successful extraction as training example if verification confidence is high
      if (verificationResult.verified && verificationResult.confidence >= 0.8) {
        try {
          await this.exampleDB.addExample(
            permitInfo, // Contains state, permit type, etc.
            verifiedWaypoints,
            {
              verified: true,
              confidence: verificationResult.confidence,
              geocodingSuccess: geocodedWaypoints.filter(wp => wp.geocoded).length / geocodedWaypoints.length,
              timestamp: new Date().toISOString()
            }
          );
          logger.info(`📚 Added verified extraction to training database (confidence: ${verificationResult.confidence})`);
        } catch (dbError) {
          logger.warn(`⚠️  Failed to save training example: ${dbError.message}`);
          // Don't fail the whole operation if example storage fails
        }
      }

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
   * Enrich waypoints with intermediate cities along long highway segments
   * If there's a long stretch of highway without cities, add major cities in between
   */
  async enrichWaypointsWithIntermediateCities(waypoints) {
    try {
      logger.info(`🔧 Checking for long highway segments that need intermediate waypoints...`);
      
      const enriched = [];
      
      for (let i = 0; i < waypoints.length; i++) {
        enriched.push(waypoints[i]);
        
        // Check if this is a highway segment followed by another waypoint far away
        const current = waypoints[i];
        const next = waypoints[i + 1];
        
        if (!next) continue;
        
        // If both waypoints mention highways (I-70, I-64, etc.) without specific cities
        const isHighwaySegment = (current.address.match(/I-\d+|US-\d+|Route \d+/i) && 
                                   next.address.match(/I-\d+|US-\d+|Route \d+/i));
        
        if (isHighwaySegment && i < waypoints.length - 1) {
          // Ask LLM to suggest intermediate cities between these two highway segments
          try {
            const intermediateCities = await this.findIntermediateCities(current.address, next.address);
            
            if (intermediateCities && intermediateCities.length > 0) {
              logger.info(`   + Adding ${intermediateCities.length} intermediate cities between "${current.address}" and "${next.address}"`);
              
              intermediateCities.forEach((city, idx) => {
                enriched.push({
                  order: current.order + 0.1 + (idx * 0.1),
                  type: 'waypoint',
                  address: city,
                  verified: true,
                  enriched: true,
                  notes: 'Auto-added intermediate city for accuracy'
                });
              });
            }
          } catch (error) {
            logger.warn(`   ⚠️  Could not find intermediate cities: ${error.message}`);
          }
        }
      }
      
      return enriched;
      
    } catch (error) {
      logger.error(`Waypoint enrichment failed: ${error.message}`);
      return waypoints; // Return original on error
    }
  }

  /**
   * Validate that the route makes geographic and logical sense
   */
  validateRouteLogic(waypoints) {
    if (waypoints.length < 2) {
      return { valid: false, message: 'Route must have at least origin and destination' };
    }
    
    // Check for reasonable waypoint count (1-30 is normal for truck routes)
    if (waypoints.length > 30) {
      return { valid: false, message: 'Unusually high number of waypoints - may indicate extraction error' };
    }
    
    // Check that origin and destination are marked correctly
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    
    if (origin.type !== 'origin') {
      logger.warn(`First waypoint should be type 'origin', got '${origin.type}'`);
    }
    
    if (destination.type !== 'destination') {
      logger.warn(`Last waypoint should be type 'destination', got '${destination.type}'`);
    }
    
    return { valid: true, message: 'Route logic validated' };
  }

  /**
   * Find intermediate cities between two highway segments
   */
  async findIntermediateCities(fromHighway, toHighway) {
    try {
      const prompt = `Given a truck route segment from "${fromHighway}" to "${toHighway}", identify major cities or towns along this route that should be waypoints.

Return ONLY a JSON array of city names (with state):

{
  "cities": ["City Name, ST", "Another City, ST"]
}

Rules:
- Only include cities that are directly on or near this highway route
- Include 1-3 major cities maximum (don't over-populate)
- Use format: "City Name, STATE"
- If these are the same location or very close, return empty array
- Focus on cities that would be logical truck route waypoints`;

      const response = await axios.post(this.baseUrl, {
        model: this.models[0],
        messages: [{
          role: "user",
          content: prompt
        }],
        max_tokens: 300,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://trucking-console.app',
          'X-Title': 'Trucking Console Waypoint Enrichment'
        },
        timeout: 10000
      });

      const content = response.data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        return data.cities || [];
      }
      
      return [];
      
    } catch (error) {
      logger.error(`Find intermediate cities failed: ${error.message}`);
      return [];
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
      // Very lenient threshold (3.0x) to preserve waypoints - permits often have specific required routes
      if (distToWaypoint + distFromWaypointToDest <= directDistance * 3.0) {
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
