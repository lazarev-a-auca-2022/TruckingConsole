const axios = require('axios');
const logger = require('../utils/logger');

/**
 * AI-powered permit parser using OpenRouter LLMs
 * This replaces manual regex-based parsers with intelligent AI parsing
 */
class AIPermitParser {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    // Use FREE Llama 3.2 Vision model (best free option with vision)
    this.model = process.env.AI_MODEL || 'meta-llama/llama-3.2-90b-vision-instruct:free';
    logger.info(`AI Parser initialized with FREE model: ${this.model}`);
  }

  /**
   * Parse permit text using AI to extract routing information
   * @param {string} permitText - The raw text extracted from permit
   * @param {string} state - The state code (IL, VA, etc.)
   * @returns {Promise<Object>} - Parsed routing information
   */
  async parsePermit(permitText, state) {
    try {
      logger.info(`AI parsing permit for state: ${state}`);
      logger.info(`Permit text length: ${permitText.length} characters`);

      if (!this.apiKey) {
        throw new Error('OpenRouter API key is required for AI parsing');
      }

      const prompt = this.buildParsingPrompt(permitText, state);

      logger.info(`Sending request to OpenRouter (${this.model})`);

      const response = await axios.post(this.baseUrl, {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1 // Low temperature for consistent structured output
        // Note: response_format not supported by free models
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://trucking-console.app',
          'X-Title': 'Trucking Console AI Parser'
        },
        timeout: 30000
      });

      const content = response.data.choices[0].message.content;
      logger.info(`AI response received: ${content.substring(0, 200)}...`);

      // Parse the JSON response
      let parseResult;
      try {
        parseResult = JSON.parse(content);
      } catch (parseError) {
        logger.error(`Failed to parse AI response as JSON: ${parseError.message}`);
        logger.info(`Attempting to extract JSON from response...`);
        
        // Try to extract JSON from text that may contain explanations
        // Strategy 1: Remove everything before first { and after last }
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const jsonStr = content.substring(firstBrace, lastBrace + 1);
          try {
            parseResult = JSON.parse(jsonStr);
            logger.info(`✅ Successfully extracted JSON by trimming explanatory text`);
          } catch (e) {
            // Strategy 2: Try to find complete JSON with balanced braces
            const braceStack = [];
            let jsonStart = -1;
            let jsonEnd = -1;
            
            for (let i = 0; i < content.length; i++) {
              if (content[i] === '{') {
                if (braceStack.length === 0) jsonStart = i;
                braceStack.push('{');
              } else if (content[i] === '}') {
                braceStack.pop();
                if (braceStack.length === 0 && jsonStart !== -1) {
                  jsonEnd = i;
                  break;
                }
              }
            }
            
            if (jsonStart !== -1 && jsonEnd !== -1) {
              try {
                parseResult = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
                logger.info(`✅ Successfully extracted JSON with balanced braces`);
              } catch (e2) {
                throw new Error(`AI returned text but no valid JSON could be extracted. Response starts with: ${content.substring(0, 100)}`);
              }
            } else {
              throw new Error(`AI did not return valid JSON. Response: ${content.substring(0, 200)}`);
            }
          }
        } else {
          throw new Error(`AI did not return valid JSON. No braces found in response.`);
        }
      }

      // Validate and format the result
      const formattedResult = this.formatParseResult(parseResult);
      
      logger.info(`AI parsing completed successfully`);
      logger.info(`Extracted: ${formattedResult.waypoints.length} waypoints`);
      
      return formattedResult;

    } catch (error) {
      logger.error(`AI permit parsing failed: ${error.message}`);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
        
        // Specific handling for 402 Payment Required
        if (error.response.status === 402) {
          logger.error('⚠️  OpenRouter API key has no credits!');
          logger.error('Please add credits at: https://openrouter.ai/credits');
        }
      }
      
      // Return empty result on failure
      return {
        startPoint: null,
        endPoint: null,
        waypoints: [],
        restrictions: [],
        distance: null,
        parseAccuracy: 0.0,
        error: error.message
      };
    }
  }

  /**
   * Build the AI prompt for parsing permit text
   */
  buildParsingPrompt(permitText, state) {
    return `You are an expert at extracting routing information from trucking permits. 

Analyze the following ${state} state truck permit text and extract ALL routing waypoints/locations mentioned in the route.

PERMIT TEXT:
${permitText}

INSTRUCTIONS:
1. Find the routing section (may be labeled as "Route", "Routing", "Authorized Route", "Routing and Special Instructions", etc.)
2. Extract EVERY location mentioned in the route in order
3. Look for:
   - City names with state abbreviations
   - Highway exits (e.g., "Take Exit 56", "Exit 221")
   - Highway interchanges (e.g., "I-64", "US-50")
   - Landmarks or geographic references
   - Origin and destination points
4. Convert exits and interchanges to nearby cities when possible
5. Ensure waypoints are in travel order from start to end
6. Look for tables with columns like "Miles", "Route", "To", "Distance"
7. Extract restrictions (weight limits, time restrictions, etc.)
8. Calculate or extract total distance if mentioned

Return ONLY valid JSON in this exact format:
{
  "startPoint": {
    "address": "City, STATE or Highway location",
    "description": "Origin description from permit"
  },
  "endPoint": {
    "address": "City, STATE or Highway location",  
    "description": "Destination description from permit"
  },
  "waypoints": [
    {
      "address": "City, STATE or Highway location",
      "description": "Route instruction or landmark"
    }
  ],
  "restrictions": [
    "Weight restriction: XX,XXX lbs",
    "Time restriction: description",
    "Height restriction: XX feet"
  ],
  "distance": "XXX miles or null",
  "parseAccuracy": 0.95,
  "notes": "Any additional relevant information"
}

CRITICAL REQUIREMENTS:
- Return ONLY the JSON object - NO explanatory text before or after
- NO markdown code blocks (no \`\`\`json)
- NO comments or notes outside the JSON
- Start your response with { and end with }
- Include at least 2 waypoints if the route has intermediate stops
- Use full city names with state codes (e.g., "Richmond, VA" not just "Richmond")
- For highway-based routes, find the nearest cities to exits/interchanges
- Set parseAccuracy between 0.0 and 1.0 based on confidence
- If no clear route is found, return empty waypoints array but still extract start/end if possible

Your response must start with { and contain only valid JSON.`;
  }

  /**
   * Format and validate the parse result
   */
  formatParseResult(parseResult) {
    // Ensure all required fields exist
    const formatted = {
      startPoint: parseResult.startPoint || null,
      endPoint: parseResult.endPoint || null,
      waypoints: parseResult.waypoints || [],
      restrictions: parseResult.restrictions || [],
      distance: parseResult.distance || null,
      parseAccuracy: parseResult.parseAccuracy || 0.5,
      notes: parseResult.notes || ''
    };

    // Validate waypoints format
    if (formatted.waypoints && Array.isArray(formatted.waypoints)) {
      formatted.waypoints = formatted.waypoints.map(wp => {
        if (typeof wp === 'string') {
          return { address: wp, description: '' };
        }
        return {
          address: wp.address || wp.location || '',
          description: wp.description || wp.instruction || ''
        };
      }).filter(wp => wp.address && wp.address.length > 0);
    }

    // Validate start/end points
    if (formatted.startPoint && typeof formatted.startPoint === 'string') {
      formatted.startPoint = { address: formatted.startPoint, description: 'Start point' };
    }
    if (formatted.endPoint && typeof formatted.endPoint === 'string') {
      formatted.endPoint = { address: formatted.endPoint, description: 'End point' };
    }

    return formatted;
  }

  /**
   * Extract just the routing section from permit text
   * This can help focus the AI on relevant content
   */
  extractRoutingSection(permitText) {
    const routingKeywords = [
      'routing and special instructions',
      'authorized route',
      'route description',
      'routing:',
      'route:',
      'origin:',
      'destination:',
      'from:.*to:',
      'miles.*route.*to'
    ];

    // Try to find routing section
    for (const keyword of routingKeywords) {
      const regex = new RegExp(`${keyword}[\\s\\S]*?(?=\\n\\n|permit|page|\\Z)`, 'i');
      const match = permitText.match(regex);
      if (match) {
        logger.info(`Found routing section using keyword: ${keyword}`);
        return match[0];
      }
    }

    // If no specific section found, return full text
    return permitText;
  }
}

module.exports = AIPermitParser;
