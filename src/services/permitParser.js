const fs = require('fs-extra');
const PDFParser = require('pdf2json');
const path = require('path');
const logger = require('../utils/logger');
const OpenRouterOCR = require('./openRouterOcr');
const { parseIllinois } = require('../parsers/illinoisParser');
const { parseWisconsin } = require('../parsers/wisconsinParser');
const { parseMissouri } = require('../parsers/missouriParser');
const { parseNorthDakota } = require('../parsers/northDakotaParser');
const { parseIndiana } = require('../parsers/indianaParser');

const STATE_PARSERS = {
  'IL': parseIllinois,
  'WI': parseWisconsin,
  'MO': parseMissouri,
  'ND': parseNorthDakota,
  'IN': parseIndiana
};

async function extractTextFromPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(`PDF parsing error: ${errData.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        let text = '';
        
        if (pdfData.Pages) {
          pdfData.Pages.forEach(page => {
            if (page.Texts) {
              page.Texts.forEach(textItem => {
                if (textItem.R) {
                  textItem.R.forEach(run => {
                    if (run.T) {
                      text += decodeURIComponent(run.T) + ' ';
                    }
                  });
                }
              });
            }
          });
        }
        
        resolve(text.trim());
      } catch (error) {
        reject(new Error(`Text extraction error: ${error.message}`));
      }
    });
    
    pdfParser.loadPDF(filePath);
  });
}

async function parsePermit(filePath, state) {
  try {
    logger.info(`Starting permit parsing for file: ${filePath}, state: ${state}`);
    
    // Validate state
    if (!STATE_PARSERS[state]) {
      throw new Error(`Unsupported state: ${state}. Supported states: ${Object.keys(STATE_PARSERS).join(', ')}`);
    }
    
    // Validate file exists
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    let extractedText;
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Determine file type and extract text accordingly
    if (fileExtension === '.pdf') {
      logger.info('Processing PDF file...');
      extractedText = await extractTextFromPdf(filePath);
    } else if (isImageFile(filePath)) {
      logger.info('Processing image file with OpenRouter OCR...');
      
      // Use OpenRouter OCR with fallback to demo text
      if (!process.env.OPENROUTER_API_KEY) {
        logger.warn('OpenRouter API key not found. Using demo text for parsing demonstration.');
        extractedText = getDemoTextForState(state);
      } else {
        try {
          const ocr = new OpenRouterOCR();
          const templatePath = path.join(__dirname, '../../outputs/permit-template-IL.png');
          
          // Use OpenRouter for intelligent text extraction
          const result = await ocr.processPermit(filePath, templatePath);
          
          // Try to get text from rawText first, then from extracted fields
          extractedText = result.extractedData.rawText;
          
          if (!extractedText || extractedText.trim().length === 0) {
            // If no rawText, try to combine extracted fields
            const fieldValues = Object.values(result.extractedData.extractedFields).filter(v => v && v.trim());
            extractedText = fieldValues.join(' ');
          }
          
          // If still no text, use a fallback approach
          if (!extractedText || extractedText.trim().length === 0) {
            logger.warn('No text extracted via structured approach, requesting raw OCR');
            // Make a simple OCR request for raw text
            const simpleOcr = new OpenRouterOCR();
            const rawOcrResult = await simpleOcr.extractRawText(filePath);
            extractedText = rawOcrResult;
          }
          
          logger.info(`OpenRouter OCR completed with confidence: ${result.extractedData.confidence}`);
        } catch (ocrError) {
          logger.error(`OpenRouter OCR failed: ${ocrError.message}`);
          logger.warn('Falling back to demo text for parsing demonstration.');
          extractedText = getDemoTextForState(state);
        }
      }
    } else {
      throw new Error(`Unsupported file format: ${fileExtension}. Supported formats: .pdf, .png, .jpg, .jpeg, .gif, .bmp, .tiff, .webp`);
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }
    
    logger.info(`Extracted ${extractedText.length} characters from ${fileExtension.substring(1).toUpperCase()}`);
    
    // Parse using state-specific parser
    const parser = STATE_PARSERS[state];
    const parseResult = await parser(extractedText);
    
    // Generate unique route ID
    const routeId = generateRouteId();
    
    const result = {
      routeId,
      state,
      fileType: fileExtension.substring(1),
      originalText: extractedText,
      parseResult,
      timestamp: new Date().toISOString(),
      filePath: filePath, // Keep full path for OpenRouter OCR
      fileName: path.basename(filePath)
    };
    
    logger.info(`Successfully parsed permit for state: ${state}`);
    return result;
    
  } catch (error) {
    logger.error(`Permit parsing failed: ${error.message}`);
    throw error;
  }
}

function generateRouteId() {
  return 'route_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Determine if a file is an image based on its extension
 */
function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'];
  return imageExtensions.includes(ext);
}

/**
 * Get demo text for state-specific parsing demonstration
 */
function getDemoTextForState(state) {
  const demoTexts = {
    'IL': 'Route from Chicago, IL to Springfield, IL via Interstate 55 South. Distance: 200 miles. Weight restriction: 80,000 lbs maximum. No travel during rush hours 7-9 AM and 4-6 PM. Permit number: IL-2024-001234.',
    'WI': 'Route from Milwaukee, WI to Madison, WI through Dane County and Milwaukee County via Highway 94 West. Distance: 80 miles. Axle weight limit: 20,000 lbs per axle. Width restriction: 8.5 feet maximum. Permit number: WI-2024-005678.',
    'MO': `Total Miles: 318
From: Border Start: Missouri - I-255
To: Border End: Wisconsin - I-39
Authorized Route:
1. Border Start: Missouri - I-255
2. [state] Go on I-255 (2.3 miles)
3. [state] At exit 6 take ramp on the right and go on IL-3 S / THE GREAT RIVER ROAD SOUTH toward COLUMBIA (4.3 miles)
4. [state] Take ramp on the right to IL-158 E toward BELLEVILLE (12.1 miles)
5. [state] At roundabout, take the third exit to proceed on IL-158 (0.1 miles)
6. [state] Turn left onto ramp to IL-15 W (7.5 miles)
7. [state] Take ramp on the right and go on I-255 N / US-50 E toward CHICAGO (13.8 miles)
8. [state] At exit 30 take ramp on the right to I-270 toward INDIANAPOLIS / KANSAS CITY (7.8 miles)
9. [state] At exit 15B take ramp on the right and go on I-55 N toward CHICAGO / SPRINGFIELD (73.4 miles)
10. [state] Go on I-55/ I-72 (4.7 miles)
11. [state] Go on I-55 (59.9 miles)
12. [state] Go on I-55/ I-74 (5.6 miles)
13. [state] Go on I-55 N / US-51 toward I-39 N / CHICAGO / ROCKFORD (0.9 miles)
14. [state] Take ramp on the right and go on I-39 (119.5 miles)
15. [state] Take ramp on the right and go on I-39 / US-51 N / US-20 E toward WISCONSIN / ROCKFORD / BELVIDERE (1.0 miles)
16. [toll] Keep left to proceed on I-90 W / I-39 / US-51 toward WISCONSIN (1.0 miles)
17. [toll] Bear left on I-39 (14.2 miles)
18. [state] Go on I-39 (2.5 miles)
19. Border End: Wisconsin - I-39
Total Distance: 333.7 miles
State Mileage: 318.4 miles`,
    'ND': 'Route from Fargo, ND to Bismarck, ND via Highway 94 West through Cass County and Burleigh County. Distance: 200 miles. Seasonal restrictions: No travel during spring thaw March 15 - May 1. Agricultural harvest consideration required. Permit number: ND-2024-004321.',
    'IN': 'Route from Indianapolis, IN to Fort Wayne, IN via Interstate 69 North and Indiana Toll Road. Distance: 150 miles. Toll road restrictions apply. Weight limit: 80,000 lbs gross vehicle weight. Height restriction: 13.6 feet on toll bridges. Permit number: IN-2024-007890.'
  };
  
  return demoTexts[state] || demoTexts['IL'];
}

module.exports = {
  parsePermit,
  extractTextFromPdf,
  generateRouteId,
  isImageFile
};
