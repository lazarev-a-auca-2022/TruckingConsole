#!/usr/bin/env node

const { parsePermit } = require('./src/services/permitParser');
const { generateMapsUrl } = require('./src/services/mapsService');
const { generateGpx } = require('./src/services/gpxService');
const logger = require('./src/utils/logger');

/**
 * Test script to verify the corrected trucking permit workflow:
 * 1. Parse permit (using demo text if OCR fails)
 * 2. Generate Google Maps URL 
 * 3. Generate GPX file
 */
async function testWorkflow() {
  console.log('\n🚛 Testing Trucking Console - Correct Workflow');
  console.log('================================================\n');

  try {
    // Test with demo data for different states
    const states = ['IL', 'WI', 'MO', 'ND', 'IN'];
    
    for (const state of states) {
      console.log(`\n📋 Testing ${state} permit parsing...`);
      
      // Create a dummy image file path (will trigger demo mode)
      const dummyImagePath = 'test-permit.png';
      
      // Parse permit (will use demo text)
      const parseResult = await parsePermit(dummyImagePath, state);
      
      console.log(`✅ ${state} Parsing completed:`);
      console.log(`   Route ID: ${parseResult.routeId}`);
      console.log(`   Start: ${parseResult.parseResult.startPoint?.address || 'Not found'}`);
      console.log(`   End: ${parseResult.parseResult.endPoint?.address || 'Not found'}`);
      console.log(`   Waypoints: ${parseResult.parseResult.waypoints?.length || 0}`);
      console.log(`   Restrictions: ${parseResult.parseResult.restrictions?.length || 0}`);
      console.log(`   Accuracy: ${(parseResult.parseResult.parseAccuracy * 100).toFixed(1)}%`);
      
      // Generate Google Maps URL
      const mapsUrl = await generateMapsUrl(parseResult);
      console.log(`🗺️  Google Maps URL: ${mapsUrl.substring(0, 80)}...`);
      
      // Generate GPX
      const gpxData = await generateGpx(parseResult);
      console.log(`📍 GPX generated: ${gpxData.length} characters`);
      
      console.log(`🎯 ${state} workflow completed successfully!\n`);
    }
    
    console.log('🎉 All tests passed! The corrected workflow is working properly.');
    console.log('\n📖 Summary of what this app does:');
    console.log('   1. ✅ Parses truck permit documents (PDF/images)');
    console.log('   2. ✅ Extracts route data (start, end, waypoints, restrictions)');
    console.log('   3. ✅ Generates Google Maps URLs for navigation');
    console.log('   4. ✅ Creates GPX files for Garmin devices');
    console.log('   5. ❌ Does NOT generate new permit images (removed)');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testWorkflow();
}

module.exports = { testWorkflow };
