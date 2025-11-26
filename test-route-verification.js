/**
 * Test script for new Route Verification Workflow
 * Tests the double-check verification system
 */

require('dotenv').config();
const path = require('path');
const RouteVerificationService = require('./src/services/routeVerificationService');
const logger = require('./src/utils/logger');

async function testRouteVerification() {
  console.log('\n='.repeat(70));
  console.log('🧪 TESTING ROUTE VERIFICATION WORKFLOW');
  console.log('='.repeat(70) + '\n');

  try {
    // Check environment variables
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('❌ OPENROUTER_API_KEY not set in environment');
      console.log('Please set OPENROUTER_API_KEY in your .env file');
      process.exit(1);
    }

    console.log('✅ OPENROUTER_API_KEY is set');
    
    if (process.env.GOOGLE_MAPS_API_KEY) {
      console.log('✅ GOOGLE_MAPS_API_KEY is set (will use Google Maps for geocoding)');
    } else {
      console.log('⚠️  GOOGLE_MAPS_API_KEY not set (will use LLM-based geocoding)');
    }

    // Test with a sample image
    const sampleImagePath = path.join(__dirname, 'outputs', 'permit-page-1.png');
    
    console.log(`\n📄 Testing with image: ${sampleImagePath}`);
    
    const verificationService = new RouteVerificationService();
    
    console.log('\n⏳ Processing permit route (this may take 30-60 seconds)...\n');
    
    const result = await verificationService.processPermitRoute(sampleImagePath);
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ VERIFICATION COMPLETED');
    console.log('='.repeat(70));
    
    console.log('\n📊 RESULTS:');
    console.log(`   Extracted Waypoints: ${result.extractedWaypoints.length}`);
    console.log(`   Verification Confidence: ${(result.verificationResult.confidence * 100).toFixed(1)}%`);
    console.log(`   Geocoded Successfully: ${result.metadata.geocodedSuccessfully}/${result.metadata.totalWaypoints}`);
    
    console.log('\n📍 WAYPOINTS:');
    result.geocodedWaypoints.forEach((wp, idx) => {
      const icon = wp.geocoded ? '✅' : '❌';
      const coords = wp.coordinates ? `${wp.coordinates.lat}, ${wp.coordinates.lng}` : 'No coordinates';
      console.log(`   ${icon} ${idx + 1}. [${wp.type}] ${wp.address}`);
      console.log(`      Coordinates: ${coords}`);
    });
    
    console.log('\n🗺️  GOOGLE MAPS JSON:');
    console.log(JSON.stringify(result.mapsJson, null, 2));
    
    console.log('\n🔗 GOOGLE MAPS URL:');
    const { generateMapsUrlFromCoordinates } = require('./src/services/mapsService');
    const mapsUrl = generateMapsUrlFromCoordinates(result.mapsJson);
    console.log(mapsUrl);
    
    console.log('\n✅ All tests passed!\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testRouteVerification();
}

module.exports = { testRouteVerification };
