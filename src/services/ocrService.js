const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Extract text from image files using OCR
 */
async function extractTextFromImage(imagePath) {
  try {
    logger.info(`Starting OCR processing for image: ${imagePath}`);
    
    // Validate file exists
    if (!await fs.pathExists(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
    
    // Get file extension to determine format
    const ext = path.extname(imagePath).toLowerCase();
    const supportedFormats = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'];
    
    if (!supportedFormats.includes(ext)) {
      throw new Error(`Unsupported image format: ${ext}. Supported formats: ${supportedFormats.join(', ')}`);
    }
    
    // Preprocess image for better OCR results
    const preprocessedPath = await preprocessImage(imagePath);
    
    logger.info('Running OCR with Tesseract...');
    
    // Run OCR with optimized settings for document text
    const { data: { text } } = await Tesseract.recognize(
      preprocessedPath,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            logger.info(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?()-[]{}/"\'\\@#$%^&*+=|<>~` \n\t',
      }
    );
    
    // Clean up preprocessed file if it's different from original
    if (preprocessedPath !== imagePath) {
      await fs.remove(preprocessedPath).catch(() => {});
    }
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the image');
    }
    
    logger.info(`OCR completed. Extracted ${text.length} characters`);
    return text.trim();
    
  } catch (error) {
    logger.error(`OCR processing failed: ${error.message}`);
    throw new Error(`Failed to extract text from image: ${error.message}`);
  }
}

/**
 * Preprocess image to improve OCR accuracy
 */
async function preprocessImage(imagePath) {
  try {
    const tempDir = './temp';
    await fs.ensureDir(tempDir);
    
    const filename = path.basename(imagePath, path.extname(imagePath));
    const preprocessedPath = path.join(tempDir, `${filename}_processed.png`);
    
    logger.info('Preprocessing image for better OCR results...');
    
    // Use Sharp to enhance the image
    await sharp(imagePath)
      .resize(null, 1200, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .grayscale()
      .normalize()
      .sharpen()
      .png({ quality: 100 })
      .toFile(preprocessedPath);
    
    logger.info(`Image preprocessed and saved to: ${preprocessedPath}`);
    return preprocessedPath;
    
  } catch (error) {
    logger.error(`Image preprocessing failed: ${error.message}`);
    // Return original path if preprocessing fails
    return imagePath;
  }
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
 * Get image metadata
 */
async function getImageMetadata(imagePath) {
  try {
    const metadata = await sharp(imagePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha
    };
  } catch (error) {
    logger.error(`Failed to get image metadata: ${error.message}`);
    return null;
  }
}

module.exports = {
  extractTextFromImage,
  preprocessImage,
  isImageFile,
  getImageMetadata
};
