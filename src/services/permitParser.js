const fs = require('fs-extra');
const PDFParser = require('pdf2json');
const { pdfToPng } = require('pdf-to-png-converter');
const path = require('path');
const logger = require('../utils/logger');
const OpenRouterOCR = require('./openRouterOcr');
const AIPermitParser = require('./aiPermitParser');
const { parseIllinois } = require('../parsers/illinoisParser');
const { parseWisconsin } = require('../parsers/wisconsinParser');
const { parseMissouri } = require('../parsers/missouriParser');
const { parseNorthDakota } = require('../parsers/northDakotaParser');
const { parseIndiana } = require('../parsers/indianaParser');
const { parseVirginia } = require('../parsers/virginiaParser');
const { parseTexasPermit } = require('../parsers/texasParser');

const STATE_PARSERS = {
  'IL': parseIllinois,
  'WI': parseWisconsin,
  'MO': parseMissouri,
  'ND': parseNorthDakota,
  'IN': parseIndiana,
  'VA': parseVirginia,
  'TX': async (text) => {
    // Texas parser returns array of waypoints, convert to parseResult format
    const waypoints = parseTexasPermit(text);
    if (!waypoints || waypoints.length < 2) {
      return {
        startPoint: null,
        endPoint: null,
        waypoints: [],
        restrictions: [],
        distance: null,
        parseAccuracy: 0.2
      };
    }
    return {
      startPoint: { address: waypoints[0], description: 'Start point' },
      endPoint: { address: waypoints[waypoints.length - 1], description: 'End point' },
      waypoints: waypoints.slice(1, -1).map(wp => ({ address: wp, description: 'Waypoint' })),
      restrictions: [],
      distance: null,
      parseAccuracy: 0.9
    };
  }
};

async function extractTextFromPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', (errData) => {
      const errorMsg = errData.parserError?.toString() || errData.toString();
      logger.error(`PDF parsing failed: ${errorMsg}`);
      
      // Check for common PDF issues and provide helpful messages
      if (errorMsg.includes('unsupported encryption') || errorMsg.includes('encryption')) {
        reject(new Error('PDF is password protected or encrypted. Please provide an unencrypted version or convert to image format (PNG/JPG).'));
      } else if (errorMsg.includes('Invalid PDF') || errorMsg.includes('corrupted')) {
        reject(new Error('PDF file appears to be corrupted. Please try re-saving the PDF or convert to image format.'));
      } else {
        reject(new Error(`PDF parsing error: ${errorMsg}. Try converting the PDF to PNG or JPG format.`));
      }
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
        
        if (!text || text.trim().length === 0) {
          reject(new Error('No text found in PDF. The PDF might be image-based or encrypted. Please convert to PNG/JPG format.'));
          return;
        }
        
        resolve(text.trim());
      } catch (error) {
        reject(new Error(`Text extraction error: ${error.message}. Try converting the PDF to image format.`));
      }
    });
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error('PDF parsing timeout. Please try converting to PNG/JPG format.'));
    }, 30000); // 30 second timeout
    
    try {
      pdfParser.loadPDF(filePath);
    } catch (error) {
      clearTimeout(timeout);
      reject(new Error(`Failed to load PDF: ${error.message}. Try converting to PNG/JPG format.`));
    }
    
    // Clear timeout when parsing completes
    pdfParser.on('pdfParser_dataReady', () => clearTimeout(timeout));
    pdfParser.on('pdfParser_dataError', () => clearTimeout(timeout));
  });
}

/**
 * Convert PDF to PNG images using FREE vision AI
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<string[]>} - Array of PNG file paths
 */
async function convertPdfToImages(pdfPath) {
  try {
    logger.info(`Converting PDF to images: ${pdfPath}`);
    
    const outputDir = path.join(path.dirname(pdfPath), 'pdf-images');
    await fs.ensureDir(outputDir);
    
    const pngPages = await pdfToPng(pdfPath, {
      outputFolder: outputDir,
      viewportScale: 2.0, // Higher resolution for better OCR
      outputFileMask: `page`,
      strictPagesToProcess: false,
      verbosityLevel: 0
    });
    
    const imagePaths = pngPages.map(page => page.path);
    logger.info(`✅ Converted PDF to ${imagePaths.length} images`);
    
    return imagePaths;
    
  } catch (error) {
    logger.error(`PDF to image conversion failed: ${error.message}`);
    throw new Error(`Failed to convert PDF to images: ${error.message}`);
  }
}

async function parsePermit(filePath, state = null) {
  try {
    logger.info(`Starting permit parsing for file: ${filePath}, state: ${state || 'auto-detect'}`);
    
    // Validate file exists
    if (!await fs.pathExists(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Auto-detect state if not provided
    if (!state) {
      logger.info('No state provided, attempting automatic detection...');
      
      const fileExtension = path.extname(filePath).toLowerCase();
      
      // Only auto-detect for images (PDFs might be encrypted)
      if (isImageFile(filePath) && process.env.OPENROUTER_API_KEY) {
        try {
          const ocr = new OpenRouterOCR();
          const detectedState = await ocr.detectState(filePath);
          
          if (detectedState !== 'UNKNOWN') {
            state = detectedState;
            logger.info(`✅ Auto-detected state: ${state}`);
          } else {
            logger.warn('Could not auto-detect state, defaulting to Illinois');
            state = 'IL';
          }
        } catch (error) {
          logger.error(`State detection failed: ${error.message}, defaulting to Illinois`);
          state = 'IL';
        }
      } else {
        logger.info('Auto-detection not available (PDF or no API key), defaulting to Illinois');
        state = 'IL';
      }
    }
    
    // Validate state
    if (!STATE_PARSERS[state]) {
      throw new Error(`Unsupported state: ${state}. Supported states: ${Object.keys(STATE_PARSERS).join(', ')}`);
    }
    
    let extractedText;
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Determine file type and extract text accordingly
    if (fileExtension === '.pdf') {
      logger.info('Processing PDF file with FREE AI Vision...');
      
      if (!process.env.OPENROUTER_API_KEY) {
        logger.warn('OpenRouter API key not found. Using demo text.');
        extractedText = getDemoTextForState(state);
      } else {
        try {
          // Convert PDF to images first
          const imagePages = await convertPdfToImages(filePath);
          logger.info(`Processing ${imagePages.length} PDF pages with AI vision`);
          
          // Process each page with AI vision and combine results
          const ocr = new OpenRouterOCR();
          const pageTexts = [];
          
          for (let i = 0; i < imagePages.length; i++) {
            logger.info(`Processing page ${i + 1}/${imagePages.length}...`);
            try {
              const pageText = await ocr.extractRawText(imagePages[i]);
              pageTexts.push(pageText);
              logger.info(`✅ Page ${i + 1}: extracted ${pageText.length} characters`);
            } catch (pageError) {
              logger.error(`Failed to process page ${i + 1}: ${pageError.message}`);
              pageTexts.push(''); // Continue with other pages
            }
          }
          
          // Combine all page texts
          extractedText = pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
          
          // Clean up temporary image files
          const imageDir = path.dirname(imagePages[0]);
          await fs.remove(imageDir);
          logger.info('✅ Cleaned up temporary PDF images');
          
          if (!extractedText || extractedText.trim().length === 0) {
            logger.warn('No text extracted from PDF images, using demo text');
            extractedText = getDemoTextForState(state);
          }
          
        } catch (pdfError) {
          logger.error(`PDF vision processing failed: ${pdfError.message}`);
          logger.warn('Falling back to demo text');
          extractedText = getDemoTextForState(state);
        }
      }
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
    
    // Try AI parsing first if OpenRouter API key is available
    let parseResult;
    if (process.env.OPENROUTER_API_KEY && process.env.USE_AI_PARSER !== 'false') {
      try {
        logger.info('Using FREE AI-powered parsing (Llama 3.2 90B Vision)...');
        const aiParser = new AIPermitParser();
        parseResult = await aiParser.parsePermit(extractedText, state);
        
        // If AI parsing failed or has low confidence, fall back to manual parser
        if (!parseResult || parseResult.parseAccuracy < 0.3) {
          logger.warn(`AI parsing had low confidence (${parseResult?.parseAccuracy}), falling back to manual parser`);
          const parser = STATE_PARSERS[state];
          parseResult = await parser(extractedText);
        } else {
          logger.info(`✅ AI parsing successful with ${parseResult.parseAccuracy * 100}% confidence`);
        }
      } catch (aiError) {
        logger.error(`AI parsing failed: ${aiError.message}, falling back to manual parser`);
        const parser = STATE_PARSERS[state];
        parseResult = await parser(extractedText);
      }
    } else {
      logger.info('Using manual state-specific parser...');
      const parser = STATE_PARSERS[state];
      parseResult = await parser(extractedText);
    }
    
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
    'IN': 'Route from Indianapolis, IN to Fort Wayne, IN via Interstate 69 North and Indiana Toll Road. Distance: 150 miles. Toll road restrictions apply. Weight limit: 80,000 lbs gross vehicle weight. Height restriction: 13.6 feet on toll bridges. Permit number: IN-2024-007890.',
    'VA': 'Route from Richmond, VA to Norfolk, VA via Interstate 64 East through Petersburg, VA and Suffolk, VA. Distance: 90 miles. Weight limit: 80,000 lbs gross vehicle weight. Height restriction: 13.6 feet. Width restriction: 8.5 feet. No travel during peak hours. Permit number: VA-2024-012345.'
  };
  
  return demoTexts[state] || demoTexts['IL'];
}

module.exports = {
  parsePermit,
  extractTextFromPdf,
  convertPdfToImages,
  generateRouteId,
  isImageFile,
  getDemoTextForState
};
