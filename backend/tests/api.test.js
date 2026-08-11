/**
 * API integration tests (supertest against the app factory — no ports, no DB
 * writes; only routes that resolve before touching Mongo are exercised).
 * Requires backend/.env (JWT_SECRET, MONGO_DB_URI) and a reachable Redis
 * for the health check to report "connected".
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { getSharedConnection } from '../src/config/redis.js';

afterAll(async () => {
  // Close the shared Redis handle so vitest can exit
  await getSharedConnection().quit().catch(() => {});
});

describe('GET /api/health', () => {
  it('reports per-dependency status with an honest status code', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('redis');
    // Tests run without a Mongo connection, so overall must be degraded
    expect(res.body.database).toBe('disconnected');
    expect(res.status).toBe(503);
  });
});

describe('auth validation', () => {
  it('rejects registration with a weak password (400, no DB touched)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'tester', password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('rejects registration with missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });
});

describe('crawl routes auth gate', () => {
  it('rejects unauthenticated crawl requests with 401', async () => {
    const res = await request(app)
      .post('/api/crawl')
      .send({ url: 'https://example.com' });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated job status requests with 401', async () => {
    const res = await request(app).get('/api/crawl/jobs/1');
    expect(res.status).toBe(401);
  });
});
