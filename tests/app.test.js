import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('API shell', () => {
  const app = createApp();

  it('returns a health response', async () => {
    const response = await request(app).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'rydora-api' });
  });

  it('issues a signed CSRF token cookie', async () => {
    const response = await request(app).get('/api/v1/auth/csrf').expect(200);
    expect(response.body.data.csrfToken).toMatch(/^[^.]+\.[^.]+$/);
    expect(response.headers['set-cookie'][0]).toContain('rydora_csrf=');
  });

  it('uses the standardized error response for unknown routes', async () => {
    const response = await request(app).get('/missing').expect(404);
    expect(response.body).toMatchObject({ success: false, code: 'ROUTE_NOT_FOUND' });
  });
});

