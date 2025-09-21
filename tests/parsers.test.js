const { parseIllinois } = require('../src/parsers/illinoisParser');

describe('Illinois Parser', () => {
  test('should parse basic Illinois permit text', async () => {
    const sampleText = `
      ILLINOIS DEPARTMENT OF TRANSPORTATION
      OVERSIZE/OVERWEIGHT PERMIT
      
      From: Chicago, IL
      To: Springfield, IL
      Via: Interstate 55
      
      Route: I-55 South from Chicago to Springfield
      Distance: 200 miles
      
      Restrictions: No travel during rush hours
    `;
    
    const result = await parseIllinois(sampleText);
    
    expect(result).toBeDefined();
    expect(result.startPoint).toBeDefined();
    expect(result.endPoint).toBeDefined();
    expect(result.startPoint.address).toBe('Chicago, IL');
    expect(result.endPoint.address).toBe('Springfield, IL');
    expect(result.distance.value).toBe(200);
    expect(result.parseAccuracy).toBeGreaterThan(0.5);
  });

  test('should handle missing route information', async () => {
    const sampleText = 'Invalid permit text with no route information';
    
    const result = await parseIllinois(sampleText);
    
    expect(result).toBeDefined();
    expect(result.parseAccuracy).toBeLessThan(0.5);
  });
});
