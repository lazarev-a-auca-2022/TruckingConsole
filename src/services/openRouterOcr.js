const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * OpenRouter OCR service using vision models to analyze permit images
 * and map text to correct form fields
 */
class OpenRouterOCR {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.templateAnalysis = new Map(); // Cache template analysis
  }

  /**
   * Analyze the permit template to identify field positions
   */
  async analyzeTemplate(templatePath) {
    try {
      logger.info(`Analyzing permit template: ${templatePath}`);
      logger.info(`OpenRouter API Key available: ${!!this.apiKey}`);
      logger.info(`API Key prefix: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'none'}`);
      
      // Check cache first
      if (this.templateAnalysis.has(templatePath)) {
        logger.info('Using cached template analysis');
        return this.templateAnalysis.get(templatePath);
      }

      // Read and encode template image
      const imageBuffer = await fs.readFile(templatePath);
      const base64Image = imageBuffer.toString('base64');
      
      const prompt = `Analyze this Illinois truck permit form template image. 

Please identify the coordinates and field names for all fillable areas. Return a JSON object with this structure:

{
  "fields": [
    {
      "name": "companyName",
      "label": "Company Name",
      "x": 110,
      "y": 58,
      "width": 300,
      "height": 20,
      "type": "text"
    },
    {
      "name": "address", 
      "label": "Address",
      "x": 110,
      "y": 78,
      "width": 300,
      "height": 20,
      "type": "text"
    }
  ],
  "formType": "Illinois Special Movement Permit",
  "dimensions": {
    "width": 612,
    "height": 792
  }
}

Look for fields like:
- Company Name
- Address  
- City/State/Zip
- Contact Name
- Phone
- Permit Number
- Effective Date
- Expiration Date
- Vehicle information (axles, weight, etc.)
- Route details

Estimate pixel coordinates based on typical 8.5x11 inch form at 72 DPI (612x792px).`;

      logger.info(`Making API request to: ${this.baseUrl}`);
      logger.info(`Request model: anthropic/claude-sonnet-4.5`);
      logger.info(`Auth header: Bearer ${this.apiKey.substring(0, 15)}...`);

      const response = await axios.post(this.baseUrl, {
        model: "anthropic/claude-sonnet-4.5",  // Free vision model alternative
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
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
          'X-Title': 'Trucking Console OCR'
        },
        timeout: 30000  // 30 second timeout
      });

      const content = response.data.choices[0].message.content;
      logger.info(`Template analysis response: ${content.substring(0, 200)}...`);
      
      // Parse JSON response
      let templateData;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          templateData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.error(`Failed to parse template analysis JSON: ${parseError.message}`);
        // Fallback to hardcoded Illinois template
        templateData = this.getDefaultIllinoisTemplate();
      }

      // Cache the analysis
      this.templateAnalysis.set(templatePath, templateData);
      logger.info(`Template analysis completed: ${templateData.fields.length} fields identified`);
      
      return templateData;

    } catch (error) {
      logger.error(`Template analysis failed: ${error.message}`);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      // Return default Illinois template on error
      return this.getDefaultIllinoisTemplate();
    }
  }

  /**
   * Extract and map text from permit image using OpenRouter vision
   */
  async extractAndMapText(imagePath, templateData) {
    try {
      logger.info(`Extracting text from permit: ${imagePath}`);
      
      // Read and encode permit image
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      const fieldDescriptions = templateData.fields.map(field => 
        `- ${field.name}: ${field.label} (${field.x}, ${field.y})`
      ).join('\n');

      const prompt = `Extract text from this filled truck permit form and map it to the correct fields.

Template fields and their positions:
${fieldDescriptions}

Please return a JSON object with the extracted text mapped to field names:

{
  "extractedFields": {
    "companyName": "extracted company name text",
    "address": "extracted address text", 
    "cityStateZip": "extracted city, state, zip",
    "contactName": "extracted contact name",
    "phone": "extracted phone number",
    "permitNumber": "extracted permit number",
    "effectiveDate": "extracted effective date",
    "expirationDate": "extracted expiration date"
  },
  "confidence": 0.95,
  "rawText": "all extracted text for reference"
}

Focus on accuracy - only include text you're confident about. Leave fields empty if uncertain.`;

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
                type: "image_url", 
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://trucking-console.app',
          'X-Title': 'Trucking Console OCR'
        },
        timeout: 30000  // 30 second timeout
      });

      const content = response.data.choices[0].message.content;
      logger.info(`Text extraction response: ${content.substring(0, 200)}...`);
      
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
        logger.error(`Failed to parse extraction JSON: ${parseError.message}`);
        extractedData = {
          extractedFields: {},
          confidence: 0.0,
          rawText: content
        };
      }

      logger.info(`Text extraction completed with confidence: ${extractedData.confidence}`);
      return extractedData;

    } catch (error) {
      logger.error(`Text extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate filled permit PNG with extracted text positioned correctly
   */
  async generateFilledPermit(templatePath, extractedData, templateAnalysis) {
    try {
      const sharp = require('sharp');
      
      logger.info('Generating filled permit PNG...');
      
      // Load template
      const templateBuffer = await fs.readFile(templatePath);
      
      // Create text overlays for each extracted field
      const textOverlays = [];
      
      for (const field of templateAnalysis.fields) {
        const text = extractedData.extractedFields[field.name];
        if (text && text.trim()) {
          const svg = `<svg width="${field.width}" height="${field.height}">
            <text x="0" y="${field.height * 0.7}" 
                  font-family="Arial" 
                  font-size="12" 
                  fill="black">${this.escapeXml(text)}</text>
          </svg>`;
          
          textOverlays.push({
            input: Buffer.from(svg),
            top: field.y,
            left: field.x
          });
        }
      }

      logger.info(`Adding ${textOverlays.length} text overlays`);

      // Composite text onto template
      const result = await sharp(templateBuffer)
        .composite(textOverlays)
        .png()
        .toBuffer();

      logger.info(`Generated filled permit: ${result.length} bytes`);
      return result;

    } catch (error) {
      logger.error(`Failed to generate filled permit: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete OCR workflow: analyze template + extract text + generate filled permit
   */
  async processPermit(permitImagePath, templatePath = null) {
    try {
      // Use default Illinois template if none specified
      if (!templatePath) {
        templatePath = path.join(__dirname, '../../outputs/permit-template-IL.png');
      }

      // Step 1: Analyze template (cached after first run)
      const templateAnalysis = await this.analyzeTemplate(templatePath);
      
      // Step 2: Extract text from permit image
      const extractedData = await this.extractAndMapText(permitImagePath, templateAnalysis);
      
      // Step 3: Generate filled permit
      const filledPermitBuffer = await this.generateFilledPermit(
        templatePath, 
        extractedData, 
        templateAnalysis
      );

      return {
        templateAnalysis,
        extractedData,
        filledPermitBuffer,
        success: true
      };

    } catch (error) {
      logger.error(`OCR workflow failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Default Illinois template structure (fallback)
   */
  getDefaultIllinoisTemplate() {
    return {
      fields: [
        { name: "companyName", label: "Company Name", x: 110, y: 58, width: 300, height: 20, type: "text" },
        { name: "address", label: "Address", x: 110, y: 78, width: 300, height: 20, type: "text" },
        { name: "cityStateZip", label: "City/State/Zip", x: 110, y: 98, width: 300, height: 20, type: "text" },
        { name: "contactName", label: "Contact Name", x: 110, y: 118, width: 300, height: 20, type: "text" },
        { name: "phone", label: "Phone", x: 110, y: 138, width: 200, height: 20, type: "text" },
        { name: "permitNumber", label: "Permit No.", x: 90, y: 730, width: 150, height: 15, type: "text" },
        { name: "effectiveDate", label: "Effective Date", x: 250, y: 750, width: 100, height: 15, type: "date" },
        { name: "expirationDate", label: "Expiration Date", x: 370, y: 750, width: 100, height: 15, type: "date" }
      ],
      formType: "Illinois Special Movement Permit",
      dimensions: { width: 612, height: 792 }
    };
  }

  /**
   * Simple raw text extraction (fallback method)
   */
  async extractRawText(imagePath) {
    try {
      logger.info(`Extracting raw text from: ${imagePath}`);
      
      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      const prompt = `Extract ALL visible text from this permit image. Return only the raw text without any formatting or structure. Include company names, addresses, numbers, dates, and any other text you can see.`;

      const response = await axios.post(this.baseUrl, {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
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
          'X-Title': 'Trucking Console OCR'
        },
        timeout: 30000
      });

      const rawText = response.data.choices[0].message.content.trim();
      logger.info(`Raw text extracted: ${rawText.length} characters`);
      return rawText;

    } catch (error) {
      logger.error(`Raw text extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Escape XML special characters
   */
  escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}

module.exports = OpenRouterOCR;
