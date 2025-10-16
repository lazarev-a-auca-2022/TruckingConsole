#!/usr/bin/env node

// Simple test to identify the exact issue
console.log('🔍 Simple PNG Test\n');

async function simplePngTest() {
  try {
    // Test 1: Direct PNG generation
    console.log('1. Testing direct PNG generation...');
    const { generateConvertedPngById } = require('./src/services/pngConverter');
    
    const testPng = await generateConvertedPngById('test_simple');
    console.log(`✅ Generated PNG: ${testPng.length} bytes`);
    console.log(`✅ Is Buffer: ${Buffer.isBuffer(testPng)}`);
    console.log(`✅ First 8 bytes: ${testPng.slice(0, 8).toString('hex')}`);
    
    // Test 2: Save to file
    console.log('\n2. Testing file save...');
    const fs = require('fs-extra');
    await fs.writeFile('./simple_test.png', testPng);
    
    const readBack = await fs.readFile('./simple_test.png');
    console.log(`✅ File saved and read: ${readBack.length} bytes`);
    console.log(`✅ Files match: ${testPng.equals(readBack)}`);
    
    // Test 3: PNG signature validation
    console.log('\n3. Testing PNG signature...');
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const fileSignature = testPng.slice(0, 8);
    console.log(`✅ Valid PNG signature: ${fileSignature.equals(pngSignature)}`);
    
    if (!fileSignature.equals(pngSignature)) {
      console.log(`❌ Expected: ${pngSignature.toString('hex')}`);
      console.log(`❌ Got:      ${fileSignature.toString('hex')}`);
    }
    
    console.log('\n✅ Simple PNG test completed!');
    
  } catch (error) {
    console.error('❌ Simple PNG test failed:');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
  }
}

simplePngTest();
