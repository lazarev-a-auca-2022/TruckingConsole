/**
 * Test the AI-powered permit parser with Virginia EZ-HAUL sample
 */

require('dotenv').config();
const AIPermitParser = require('./src/services/aiPermitParser');
const fs = require('fs');
const path = require('path');

// Sample Virginia EZ-HAUL permit text (from your PDF)
const virginiaPermitText = `
EZ-HAUL
www.ezhaulvirginia.com
P.O. Box 26302 Richmond, VA 23260

Routing and Special Instructions
Origin: I-64 WV Line

Miles    Route           To                                                          Distance  Est. Time
-56.34   I-64 E          Take Exit 56                                               56.34     00h:34m
-0.77    I-64 Ramp       Continue straight on I-81N                                 57.11     00h:00m
-28.78   I-81N           Take Exit 221 toward I 64 East/Richmond                    85.89     00h:26m
-0.44    I-64 Ramp       Merge onto I-64E                                           87.34     00h:00m
-89.12   I-64E           Take Exit 177 toward I 295 North/Washington/Norfolk        176.45    01h:20m
-1.22    Ramp            Continue straight on I-295S                                177.67    00h:01m
-22.61   I-295S          Take Exit 28A toward I 64 East/Norfolk                     200.41    00h:20m
-1.39    Ramp            Continue straight on I-64E                                 201.87    00h:01m
-62.33   I-64E           Take Exit 264 toward I 664 South/Downtown Newport News/Suffolk/Chesapeake  264.2     00h:56m
-0.56    Ramp            Take ramp and proceed on I-664E [HAMPTON ROADS BELTWAY]   264.76    00h:00m
-19.78   I-664E          Take Exit 19B toward I 64/Chesapeake/Virginia Beach       284.54    00h:17m
-0.58    I-64W HAMPTON
         ROADS
         BELTWAY         Continue straight on I-64W [HAMPTON ROADS BELTWAY]         285.12    00h:00m
         Ramp
-15.09   I-64W           Take Exit 284B toward I 264 East/Newtown Rd/Va Beach      300.21    00h:13m
-1.12    Ramp            Continue straight on I-264E [VIRGINIA BEACH-NORFOLK EXPRESS]  301.33    00h:01m
-7.37    I-264E          Arrive at destination                                      308.7     00h:07m

Destination: VIRGINIA BEACH-NORFOLK                                                Totals:   308.7     04h:37m
`;

async function testAIParser() {
  console.log('🧪 Testing AI-Powered Permit Parser\n');
  console.log('=' .repeat(60));
  
  // Check API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ ERROR: OPENROUTER_API_KEY not found in environment');
    console.error('Please set it in .env file or environment variables');
    process.exit(1);
  }
  
  console.log(`✅ API Key found: ${process.env.OPENROUTER_API_KEY.substring(0, 15)}...`);
  console.log(`📝 Model: ${process.env.AI_MODEL || 'anthropic/claude-3.5-sonnet'}`);
  console.log('\n' + '='.repeat(60) + '\n');
  
  try {
    const aiParser = new AIPermitParser();
    
    console.log('📄 Parsing Virginia EZ-HAUL permit...\n');
    console.log('Permit text preview:');
    console.log(virginiaPermitText.substring(0, 300) + '...\n');
    
    const startTime = Date.now();
    const result = await aiParser.parsePermit(virginiaPermitText, 'VA');
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('✅ AI Parsing completed in ' + duration + 's\n');
    console.log('=' .repeat(60));
    console.log('PARSE RESULTS:');
    console.log('=' .repeat(60));
    
    console.log('\n📍 Start Point:');
    console.log(JSON.stringify(result.startPoint, null, 2));
    
    console.log('\n📍 End Point:');
    console.log(JSON.stringify(result.endPoint, null, 2));
    
    console.log(`\n🛣️  Waypoints: ${result.waypoints.length} found`);
    result.waypoints.forEach((wp, i) => {
      console.log(`  ${i + 1}. ${wp.address}`);
      if (wp.description) {
        console.log(`     └─ ${wp.description}`);
      }
    });
    
    console.log('\n⚠️  Restrictions:');
    if (result.restrictions.length > 0) {
      result.restrictions.forEach(r => console.log(`  - ${r}`));
    } else {
      console.log('  (none specified)');
    }
    
    console.log(`\n📏 Distance: ${result.distance || 'N/A'}`);
    console.log(`📊 Parse Accuracy: ${(result.parseAccuracy * 100).toFixed(1)}%`);
    
    if (result.notes) {
      console.log(`\n📝 Notes: ${result.notes}`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Validate results
    console.log('\n✅ VALIDATION:');
    if (result.startPoint && result.endPoint) {
      console.log('  ✓ Start and end points extracted');
    } else {
      console.log('  ✗ Missing start or end point');
    }
    
    if (result.waypoints.length >= 2) {
      console.log(`  ✓ ${result.waypoints.length} waypoints extracted (expected 10+)`);
    } else {
      console.log(`  ⚠ Only ${result.waypoints.length} waypoints extracted (expected 10+)`);
    }
    
    if (result.parseAccuracy >= 0.8) {
      console.log(`  ✓ High confidence: ${(result.parseAccuracy * 100).toFixed(1)}%`);
    } else {
      console.log(`  ⚠ Low confidence: ${(result.parseAccuracy * 100).toFixed(1)}%`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TEST COMPLETED SUCCESSFULLY');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run test
testAIParser();
