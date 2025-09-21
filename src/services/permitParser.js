const fs = require('fs-extra');
const PDFParser = require('pdf2json');
const path = require('path');
const logger = require('../utils/logger');
const { extractTextFromImage, isImageFile } = require('./ocrService');
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
      logger.info('Processing image file with OCR...');
      extractedText = await extractTextFromImage(filePath);
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
      filePath: path.basename(filePath)
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

module.exports = {
  parsePermit,
  extractTextFromPdf
};
