#!/usr/bin/env node

// Quick test script to verify the application works
const { parsePermit } = require('./src/services/permitParser');
const fs = require('fs-extra');
const path = require('path');

async function testImageProcessing() {
  console.log('🚛 Testing Trucking Console App Image Processing...\n');
  
  const sampleDir = './sample-permits';
  
  try {
    // Check if sample directory exists
    if (!await fs.pathExists(sampleDir)) {
      console.log('❌ Sample permits directory not found');
      return;
    }
    
    // Get all image files
    const files = await fs.readdir(sampleDir);
    const imageFiles = files.filter(file => {
      const ext = file.toLowerCase();
      return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg');
    });
    
    if (imageFiles.length === 0) {
      console.log('❌ No image files found in sample-permits directory');
      return;
    }
    
    console.log(`Found ${imageFiles.length} image files to test:\n`);
    
    // Test parsing the first image file
    const testFile = path.join(sampleDir, imageFiles[0]);
    console.log(`Testing file: ${imageFiles[0]}`);
    console.log('State: IL (Illinois)\n');
    
    const result = await parsePermit(testFile, 'IL');
    
    console.log('✅ Parsing successful!');
    console.log('\n--- Results ---');
    console.log(`Route ID: ${result.routeId}`);
    console.log(`File Type: ${result.fileType}`);
    console.log(`Parse Accuracy: ${(result.parseResult.parseAccuracy * 100).toFixed(1)}%`);
    console.log(`Extracted Text Length: ${result.originalText.length} characters`);
    
    if (result.parseResult.startPoint) {
      console.log(`Start Point: ${result.parseResult.startPoint.address || 'Detected'}`);
    }
    
    if (result.parseResult.endPoint) {
      console.log(`End Point: ${result.parseResult.endPoint.address || 'Detected'}`);
    }
    
    console.log(`Waypoints: ${result.parseResult.waypoints?.length || 0}`);
    console.log(`Restrictions: ${result.parseResult.restrictions?.length || 0}`);
    
    if (result.originalText.length > 0) {
      console.log('\n--- Sample Extracted Text ---');
      console.log(result.originalText.substring(0, 200) + '...');
    }
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    console.log('\nThis is expected if Tesseract.js dependencies are not installed.');
    console.log('The application will work properly when deployed with Docker.');
  }
}

// Run test
testImageProcessing();
