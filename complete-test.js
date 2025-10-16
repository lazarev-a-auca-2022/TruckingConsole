#!/usr/bin/env node

console.log('🔍 Complete Download Debug Test\n');

async function completeTest() {
  try {
    const axios = require('axios');
    const routeId = 'route_1758460832167_c2g3tkajl';
    
    console.log('1. Testing health endpoint...');
    try {
      const health = await axios.get('http://localhost:3000/health');
      console.log('✅ Health check OK:', health.data.status);
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
      return;
    }
    
    console.log('\n2. Testing simple route endpoint...');
    try {
      const testRoute = await axios.get(`http://localhost:3000/api/test-route/${routeId}`);
      console.log('✅ Test route OK:', testRoute.data.message);
    } catch (error) {
      console.log('❌ Test route failed:', error.message);
    }
    
    console.log('\n3. Testing debug PNG endpoint...');
    try {
      const debugPng = await axios.get('http://localhost:3000/api/debug-png', {
        responseType: 'arraybuffer'
      });
      console.log('✅ Debug PNG OK:', debugPng.data.length, 'bytes');
    } catch (error) {
      console.log('❌ Debug PNG failed:', error.message);
    }
    
    console.log('\n4. Testing test PNG endpoint...');
    try {
      const testPng = await axios.get('http://localhost:3000/api/test-png', {
        responseType: 'arraybuffer'
      });
      console.log('✅ Test PNG OK:', testPng.data.length, 'bytes');
    } catch (error) {
      console.log('❌ Test PNG failed:', error.message);
    }
    
    console.log('\n5. Testing convert-png endpoint...');
    try {
      const convertPng = await axios.get(`http://localhost:3000/api/convert-png/${routeId}`, {
        responseType: 'arraybuffer',
        timeout: 10000
      });
      console.log('✅ Convert PNG OK:', convertPng.data.length, 'bytes');
      console.log('✅ Content-Type:', convertPng.headers['content-type']);
      
      // Save the result
      const fs = require('fs-extra');
      await fs.writeFile('./debug_convert_result.png', convertPng.data);
      console.log('✅ Saved as debug_convert_result.png');
      
    } catch (error) {
      console.log('❌ Convert PNG failed:', error.message);
      if (error.response) {
        console.log('❌ Status:', error.response.status);
        console.log('❌ Headers:', error.response.headers);
        console.log('❌ Data:', error.response.data.toString().substring(0, 200));
      }
    }
    
    console.log('\n6. Testing browser-like request...');
    try {
      const browserPng = await axios.get(`http://localhost:3000/api/convert-png/${routeId}`, {
        responseType: 'arraybuffer',
        headers: {
          'Accept': 'image/png,image/*,*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      console.log('✅ Browser-like request OK:', browserPng.data.length, 'bytes');
    } catch (error) {
      console.log('❌ Browser-like request failed:', error.message);
    }
    
    console.log('\n✅ Complete test finished!');
    
  } catch (error) {
    console.error('❌ Complete test failed:', error.message);
  }
}

completeTest();
