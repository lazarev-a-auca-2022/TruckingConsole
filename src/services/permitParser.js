const fs = require('fs-extra');
const { pdfToPng } = require('pdf-to-png-converter');
const path = require('path');
const logger = require('../utils/logger');
const OpenRouterOCR = require('./openRouterOcr');
const RouteVerificationService = require('./routeVerificationService');
const AIPermitParser = require('./aiPermitParser');

// Supported states for AI parsing
const SUPPORTED_STATES = ['IL', 'WI', 'MO', 'ND', 'IN', 'VA', 'TX'];

/**
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
        logger.info('');
        state = 'IL';
      }
    }
    
    // Validate state
    if (!SUPPORTED_STATES.includes(state)) {
      throw new Error(`Unsupported state: ${state}. Supported states: ${SUPPORTED_STATES.join(', ')}`);
    }
    
    let extractedText;
    const fileExtension = path.extname(filePath).toLowerCase();
    
    // Determine file type and extract text accordingly
    if (fileExtension === '.pdf') {
      logger.info('📄 Processing PDF directly with Claude Sonnet 4.5 (PDF native support)...');
      
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OpenRouter API key is required for PDF processing. Please set OPENROUTER_API_KEY in docker-compose.yml');
      }
      
      try {
        // Convert PDF to images for processing (Claude doesn't support PDFs via OpenRouter)
        logger.info('📸 Converting PDF to images for processing...');
        const imagePaths = await convertPdfToImages(filePath);
        const imageDir = path.dirname(imagePaths[0]);
        
        logger.info('🗺️  Running coordinate verification on first page...');
        const verificationService = new RouteVerificationService();
        const verificationResult = await verificationService.processPermitRoute(imagePaths[0]);
        
        // Store verification result for later use in mapsService
        if (!parsePermit.verificationCache) {
          parsePermit.verificationCache = new Map();
        }
        parsePermit.verificationCache.set(filePath, verificationResult);
        logger.info(`✅ PDF coordinate verification completed with ${verificationResult.geocodedWaypoints.length} geocoded waypoints`);
        
        // Clean up temporary images
        await fs.remove(imageDir);
        logger.info('🗑️  Cleaned up temporary image files');
        
        // Use extracted waypoint data as text for AI parser (minimal text extraction)
        const waypointSummary = verificationResult.geocodedWaypoints
          .map(wp => `${wp.address} (${wp.type})`)
          .join('\n');
        
        extractedText = `Route extracted via coordinate verification:\n${waypointSummary}`;
        logger.info(`✅ Using coordinate-based route data from PDF via image processing`);
        
      } catch (pdfError) {
        logger.error(`❌ PDF vision processing failed: ${pdfError.message}`);
        throw new Error(`Unable to process PDF: ${pdfError.message}`);
      }
    } else if (isImageFile(filePath)) {
      logger.info('Processing image file with NEW double-check verification workflow...');
      
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OpenRouter API key is required for image processing. Please set OPENROUTER_API_KEY in docker-compose.yml');
      }
      
      // NEW WORKFLOW: Use RouteVerificationService for double-checking
      const verificationService = new RouteVerificationService();
      const verificationResult = await verificationService.processPermitRoute(filePath);
      
      // Store verification result for later use in mapsService
      if (!parsePermit.verificationCache) {
        parsePermit.verificationCache = new Map();
      }
      parsePermit.verificationCache.set(filePath, verificationResult);
      
      // For backwards compatibility, still extract text for state parsers
      const ocr = new OpenRouterOCR();
      const templatePath = path.join(__dirname, '../../outputs/permit-template-IL.png');
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
        const simpleOcr = new OpenRouterOCR();
        const rawOcrResult = await simpleOcr.extractRawText(filePath);
        extractedText = rawOcrResult;
      }
      
      logger.info(`OpenRouter OCR completed with confidence: ${result.extractedData.confidence}`);
      logger.info(`Route verification completed with ${verificationResult.geocodedWaypoints.length} waypoints`);
    } else {
      throw new Error(`Unsupported file format: ${fileExtension}. Supported formats: .pdf, .png, .jpg, .jpeg, .gif, .bmp, .tiff, .webp`);
    }
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }
    
    logger.info(`Extracted ${extractedText.length} characters from ${fileExtension.substring(1).toUpperCase()}`);
    
    // Use AI parsing (required - no fallback to manual parsers)
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key is required. Please set OPENROUTER_API_KEY in docker-compose.yml');
    }
    
    if (process.env.USE_AI_PARSER === 'false') {
      throw new Error('AI parsing is disabled but manual parsers have been removed. Set USE_AI_PARSER=true');
    }
    
    logger.info('Using AI-powered parsing...');
    const aiParser = new AIPermitParser();
    const parseResult = await aiParser.parsePermit(extractedText, state);
    
    if (!parseResult || parseResult.waypoints.length === 0) {
      logger.warn(`⚠️  AI parsing returned no waypoints. Parse accuracy: ${parseResult?.parseAccuracy || 0}`);
    } else {
      logger.info(`✅ AI parsing successful with ${parseResult.parseAccuracy * 100}% confidence`);
      logger.info(`   Extracted ${parseResult.waypoints.length} waypoints`);
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
    
    // Add verification data if available (for images)
    if (parsePermit.verificationCache && parsePermit.verificationCache.has(filePath)) {
      const verificationData = parsePermit.verificationCache.get(filePath);
      result.verificationData = verificationData;
      result.mapsJson = verificationData.mapsJson; // Add the Google Maps compatible JSON
      logger.info(`✅ Added verification data with ${verificationData.geocodedWaypoints.length} geocoded waypoints`);
    }
    
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
module.exports = {
  parsePermit,
  convertPdfToImages,
  generateRouteId,
  isImageFile
};
