const fs = require('fs-extra');
const path = require('path');
const { parseVirginia } = require('./src/parsers/virginiaParser');

async function testVirginiaParser() {
  console.log('🧪 Testing Virginia Parser with EZ-HAUL format...\n');
  
  try {
    // Read the sample Virginia permit text
    const samplePath = path.join(__dirname, 'sample-permits', 'virginia-ezhaul-sample.txt');
    const text = await fs.readFile(samplePath, 'utf8');
    
    console.log('📄 Sample permit text loaded');
    console.log('Text length:', text.length, 'characters\n');
    
    // Parse the permit
    console.log('🔍 Parsing permit...\n');
    const result = await parseVirginia(text);
    
    // Display results
    console.log('✅ Parsing completed!\n');
    console.log('=' .repeat(60));
    console.log('PARSE RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n📍 START POINT:');
    console.log(`   ${result.startPoint.address}`);
    console.log(`   ${result.startPoint.description}`);
    
    console.log('\n📍 END POINT:');
    console.log(`   ${result.endPoint.address}`);
    console.log(`   ${result.endPoint.description}`);
    
    console.log('\n🛣️  WAYPOINTS:');
    if (result.waypoints.length === 0) {
      console.log('   ⚠️  No waypoints extracted!');
    } else {
      result.waypoints.forEach((wp, idx) => {
        console.log(`   ${idx + 1}. ${wp.address}`);
        if (wp.route) console.log(`      Route: ${wp.route}`);
        if (wp.description) console.log(`      ${wp.description}`);
      });
    }
    
    console.log('\n📊 METADATA:');
    console.log(`   Parse Accuracy: ${(result.parseAccuracy * 100).toFixed(1)}%`);
    if (result.distance) {
      console.log(`   Total Distance: ${result.distance.value} ${result.distance.unit}`);
    }
    if (result.permitNumber) {
      console.log(`   Permit Number: ${result.permitNumber}`);
    }
    console.log(`   Restrictions: ${result.restrictions.length} found`);
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n📈 Total waypoints extracted: ${result.waypoints.length}`);
    console.log(`   Expected: 10-14 waypoints for EZ-HAUL format`);
    
    if (result.waypoints.length >= 5) {
      console.log('\n✅ SUCCESS: Parser extracted multiple waypoints!');
    } else {
      console.log('\n❌ WARNING: Low waypoint count. Parser may need adjustment.');
    }
    
    // Generate Google Maps URL preview
    console.log('\n🗺️  GOOGLE MAPS URL PREVIEW:');
    const allPoints = [result.startPoint.address, ...result.waypoints.map(w => w.address), result.endPoint.address];
    console.log(`   Total points for navigation: ${allPoints.length}`);
    console.log(`   First 3 points: ${allPoints.slice(0, 3).join(' → ')}`);
    console.log(`   Last 3 points: ${allPoints.slice(-3).join(' → ')}`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testVirginiaParser()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
