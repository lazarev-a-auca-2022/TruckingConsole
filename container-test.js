#!/usr/bin/env node

// Simple container test that doesn't require external files
console.log('🔍 Container PNG Test\n');

const { generateConvertedPngById } = require('./src/services/pngConverter');

async function containerTest() {
  try {
    console.log('1. Testing Illinois PNG...');
    const ilPng = await generateConvertedPngById('test_il');
    console.log(`✅ IL PNG: ${ilPng.length} bytes`);
    
    console.log('2. Testing Wisconsin PNG...');
    const wiPng = await generateConvertedPngById('test_wi');  
    console.log(`✅ WI PNG: ${wiPng.length} bytes`);
    
    console.log('3. Checking PNG signatures...');
    const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    console.log(`IL signature valid: ${ilPng.slice(0, 4).equals(pngSig)}`);
    console.log(`WI signature valid: ${wiPng.slice(0, 4).equals(pngSig)}`);
    
    console.log('\n✅ Container test completed!');
    
  } catch (error) {
    console.error('❌ Container test failed:');
    console.error(error.message);
  }
}

containerTest();
