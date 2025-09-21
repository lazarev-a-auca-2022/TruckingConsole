const request = require('supertest');
const { app } = require('../src/server');

describe('API Endpoints', () => {
  test('GET / should return API information', async () => {
    const response = await request(app).get('/');
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Trucking Console API');
  });

  test('GET /health should return health status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  test('POST /api/parse should require file upload', async () => {
    const response = await request(app)
      .post('/api/parse')
      .send({ state: 'IL' });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No file uploaded');
  });

  test('POST /api/parse should require state parameter', async () => {
    const response = await request(app)
      .post('/api/parse');
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('State parameter is required');
  });
});
