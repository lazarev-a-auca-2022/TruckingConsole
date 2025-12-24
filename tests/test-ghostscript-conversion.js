/**
 * Test script to verify Ghostscript PDF conversion
 * This test validates the convertPdfToImages function with Ghostscript
 */

const fs = require('fs-extra');
const path = require('path');
const { convertPdfToImages } = require('../src/services/permitParser');

async function testGhostscriptConversion() {
  console.log('🧪 Testing Ghostscript PDF Conversion...\n');
  
  const testPdfPath = path.join(__dirname, '../sample-permits/18-VA 0905.pdf');
  
  // Check if test PDF exists
  if (!await fs.pathExists(testPdfPath)) {
    console.error('❌ Test PDF not found:', testPdfPath);
    process.exit(1);
  }
  
  console.log('📄 Test PDF:', testPdfPath);
  
  try {
    // Test conversion
    console.log('\n🔄 Converting PDF to images...');
    const imagePaths = await convertPdfToImages(testPdfPath);
    
    console.log('\n✅ Conversion successful!');
    console.log(`📸 Generated ${imagePaths.length} images:`);
    
    // Verify each image file exists and log details
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      const exists = await fs.pathExists(imagePath);
      const stats = exists ? await fs.stat(imagePath) : null;
      
      console.log(`   ${i + 1}. ${path.basename(imagePath)}`);
      console.log(`      Path: ${imagePath}`);
      console.log(`      Exists: ${exists}`);
      if (stats) {
        console.log(`      Size: ${(stats.size / 1024).toFixed(2)} KB`);
      }
    }
    
    // Cleanup
    const outputDir = path.dirname(imagePaths[0]);
    console.log('\n🗑️  Cleaning up temporary files...');
    await fs.remove(outputDir);
    console.log('✅ Cleanup complete');
    
    console.log('\n✅ All tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    
    // Check if Ghostscript is available
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout } = await execAsync('gs --version');
      console.log('\nℹ️  Ghostscript version:', stdout.trim());
    } catch (gsError) {
      console.error('\n⚠️  Ghostscript is not installed or not in PATH');
      console.error('   This test requires Ghostscript to be installed.');
      console.error('   In Docker, Ghostscript is installed via the Dockerfile.');
    }
    
    process.exit(1);
  }
}

// Run test
testGhostscriptConversion();
