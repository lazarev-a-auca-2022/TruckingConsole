// Simple test to show how the Missouri permit will be parsed
const { parseMissouri } = require('./src/parsers/missouriParser');

const sampleText = `Total Miles: 318
From: Border Start: Missouri - I-255
To: Border End: Wisconsin - I-39
Authorized Route:
1. Border Start: Missouri - I-255
2. [state] Go on I-255 (2.3 miles)
3. [state] At exit 6 take ramp on the right and go on IL-3 S / THE GREAT RIVER ROAD SOUTH toward COLUMBIA (4.3 miles)
4. [state] Take ramp on the right to IL-158 E toward BELLEVILLE (12.1 miles)
5. [state] At roundabout, take the third exit to proceed on IL-158 (0.1 miles)
6. [state] Turn left onto ramp to IL-15 W (7.5 miles)
7. [state] Take ramp on the right and go on I-255 N / US-50 E toward CHICAGO (13.8 miles)
8. [state] At exit 30 take ramp on the right to I-270 toward INDIANAPOLIS / KANSAS CITY (7.8 miles)
9. [state] At exit 15B take ramp on the right and go on I-55 N toward CHICAGO / SPRINGFIELD (73.4 miles)
10. [state] Go on I-55/ I-72 (4.7 miles)
11. [state] Go on I-55 (59.9 miles)
12. [state] Go on I-55/ I-74 (5.6 miles)
13. [state] Go on I-55 N / US-51 toward I-39 N / CHICAGO / ROCKFORD (0.9 miles)
14. [state] Take ramp on the right and go on I-39 (119.5 miles)
15. [state] Take ramp on the right and go on I-39 / US-51 N / US-20 E toward WISCONSIN / ROCKFORD / BELVIDERE (1.0 miles)
16. [toll] Keep left to proceed on I-90 W / I-39 / US-51 toward WISCONSIN (1.0 miles)
17. [toll] Bear left on I-39 (14.2 miles)
18. [state] Go on I-39 (2.5 miles)
19. Border End: Wisconsin - I-39
Total Distance: 333.7 miles
State Mileage: 318.4 miles`;

async function testParsing() {
  try {
    console.log('🚛 Testing Missouri Permit Parsing...\n');
    
    const result = await parseMissouri(sampleText);
    
    console.log('📍 EXTRACTED ROUTE DATA:');
    console.log('========================');
    console.log(`Start Point: ${result.startPoint?.address || 'Not found'}`);
    console.log(`End Point: ${result.endPoint?.address || 'Not found'}`);
    console.log(`Waypoints: ${result.waypoints?.length || 0}`);
    
    if (result.waypoints && result.waypoints.length > 0) {
      result.waypoints.forEach((wp, i) => {
        console.log(`  ${i + 1}. ${wp.address}`);
      });
    }
    
    console.log(`\nHighways: ${result.routeInfo?.highways?.join(', ') || 'None detected'}`);
    console.log(`Parse Accuracy: ${(result.parseAccuracy * 100).toFixed(1)}%`);
    
    // Show what the Google Maps URL would look like
    console.log('\n🗺️  GOOGLE MAPS URL:');
    console.log('===================');
    
    const waypoints = [];
    if (result.startPoint?.address) waypoints.push(encodeURIComponent(result.startPoint.address));
    if (result.waypoints) {
      result.waypoints.forEach(wp => {
        if (wp.address) waypoints.push(encodeURIComponent(wp.address));
      });
    }
    if (result.endPoint?.address) waypoints.push(encodeURIComponent(result.endPoint.address));
    
    if (waypoints.length >= 2) {
      const origin = waypoints[0];
      const destination = waypoints[waypoints.length - 1];
      const intermediate = waypoints.slice(1, -1);
      
      let mapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;
      if (intermediate.length > 0) {
        mapsUrl += `/${intermediate.join('/')}`;
      }
      mapsUrl += '?travelmode=driving';
      
      console.log(mapsUrl);
    } else {
      console.log('Not enough waypoints extracted for route');
    }
    
  } catch (error) {
    console.error('❌ Parsing failed:', error.message);
  }
}

testParsing();
