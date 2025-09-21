#!/usr/bin/env node

// Direct test of the failing route ID
console.log('🔍 Testing Specific Route ID\n');

async function testSpecificRoute() {
  try {
    const routeId = 'route_1758460832167_c2g3tkajl';
    console.log(`Testing route ID: ${routeId}`);
    
    // Test 1: Direct PNG generation
    console.log('\n1. Testing direct PNG generation...');
    const { generateConvertedPngById } = require('./src/services/pngConverter');
    
    const pngBuffer = await generateConvertedPngById(routeId);
    console.log(`✅ PNG generated: ${pngBuffer.length} bytes`);
    console.log(`✅ PNG signature: ${pngBuffer.slice(0, 8).toString('hex')}`);
    
    // Test 2: Test via HTTP API
    console.log('\n2. Testing via HTTP API...');
    const axios = require('axios');
    
    try {
      const response = await axios.get(`http://localhost:3000/api/convert-png/${routeId}`, {
        responseType: 'arraybuffer',
        timeout: 5000
      });
      
      console.log(`✅ HTTP response: ${response.status}`);
      console.log(`✅ Content-Type: ${response.headers['content-type']}`);
      console.log(`✅ Data length: ${response.data.length} bytes`);
      
      // Save the HTTP response
      const fs = require('fs-extra');
      await fs.writeFile(`./http_test_${Date.now()}.png`, response.data);
      console.log(`✅ HTTP PNG saved`);
      
    } catch (httpError) {
      console.error(`❌ HTTP test failed: ${httpError.message}`);
      if (httpError.response) {
        console.error(`❌ HTTP status: ${httpError.response.status}`);
        console.error(`❌ HTTP data: ${httpError.response.data}`);
      }
    }
    
    console.log('\n✅ Specific route test completed!');
    
  } catch (error) {
    console.error('❌ Specific route test failed:');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
  }
}

testSpecificRoute();
