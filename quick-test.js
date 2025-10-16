#!/usr/bin/env node

console.log('🚛 Quick PNG Download Test\n');

async function testDownload() {
  try {
    const axios = require('axios');
    
    console.log('1. Testing health endpoint...');
    const health = await axios.get('http://localhost:3000/health');
    console.log(`✅ Health: ${health.data.status}`);
    
    console.log('\n2. Testing test PNG endpoint...');
    const testPng = await axios.get('http://localhost:3000/api/test-png', {
      responseType: 'arraybuffer'
    });
    console.log(`✅ Test PNG: ${testPng.data.length} bytes`);
    
    console.log('\n3. Testing specific route PNG...');
    const routePng = await axios.get('http://localhost:3000/api/convert-png/route_1758458400428_g7f4rb2v4', {
      responseType: 'arraybuffer'
    });
    console.log(`✅ Route PNG: ${routePng.data.length} bytes`);
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:');
    console.error(`Status: ${error.response?.status}`);
    console.error(`Message: ${error.message}`);
    console.error(`Response: ${error.response?.data}`);
  }
}

testDownload();
