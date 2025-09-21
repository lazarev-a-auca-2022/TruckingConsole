#!/usr/bin/env node

const { generateConvertedPngById } = require('./src/services/pngConverter');
const fs = require('fs-extra');

async function debugPng() {
  console.log('🔍 Debugging PNG Generation...\n');
  
  try {
    console.log('1. Testing PNG generation...');
    const testId = 'debug_test_123';
    const pngBuffer = await generateConvertedPngById(testId);
    
    console.log(`✅ PNG generated: ${pngBuffer.length} bytes`);
    console.log(`📊 Buffer type: ${typeof pngBuffer}`);
    console.log(`📊 Is Buffer: ${Buffer.isBuffer(pngBuffer)}`);
    console.log(`📊 First 16 bytes: ${pngBuffer.slice(0, 16).toString('hex')}`);
    
    // Check PNG signature
    const pngSignature = pngBuffer.slice(0, 8);
    const expectedSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const signatureMatch = pngSignature.equals(expectedSignature);
    
    console.log(`📊 PNG signature valid: ${signatureMatch}`);
    
    if (!signatureMatch) {
      console.log(`❌ Expected: ${expectedSignature.toString('hex')}`);
      console.log(`❌ Got:      ${pngSignature.toString('hex')}`);
    }
    
    // Save test file
    const testFile = './debug_test.png';
    await fs.writeFile(testFile, pngBuffer);
    console.log(`💾 Test PNG saved as: ${testFile}`);
    
    // Try to read it back
    const readBack = await fs.readFile(testFile);
    console.log(`📖 Read back: ${readBack.length} bytes`);
    console.log(`🔄 Buffers match: ${pngBuffer.equals(readBack)}`);
    
    console.log('\n✅ PNG debugging completed successfully!');
    
  } catch (error) {
    console.error('❌ PNG debugging failed:');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
  }
}

debugPng();
