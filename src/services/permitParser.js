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
      
      // Use OpenRouter OCR only - no Tesseract fallback
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OpenRouter API key is required for image processing. Please set OPENROUTER_API_KEY environment variable.');
      }
      
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
        logger.warn('No text extracted via structured approach, requesting raw OCR from DeepSeek');
        // Make a simple OCR request for raw text
        const simpleOcr = new OpenRouterOCR();
        const rawOcrResult = await simpleOcr.extractRawText(filePath);
        extractedText = rawOcrResult;
      }
      
      logger.info(`OpenRouter OCR completed with confidence: ${result.extractedData.confidence}`);
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

module.exports = {
  parsePermit,
  extractTextFromPdf,
  generateRouteId,
  isImageFile
};
