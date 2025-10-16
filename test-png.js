#!/usr/bin/env node

// Test PNG generation
const { generateConvertedPngById } = require('./src/services/pngConverter');
const fs = require('fs-extra');

async function testPngGeneration() {
  try {
    console.log('Testing PNG generation...');
    
    const testRouteId = 'test_route_123';
    const pngBuffer = await generateConvertedPngById(testRouteId);
    
    console.log(`Generated PNG: ${pngBuffer.length} bytes`);
    
    // Save test file
    await fs.writeFile('./test_output.png', pngBuffer);
    console.log('✅ Test PNG saved as test_output.png');
    
  } catch (error) {
    console.error('❌ PNG generation test failed:', error.message);
    console.error(error.stack);
  }
}

testPngGeneration();
