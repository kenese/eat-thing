import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  lt: () => null,
  isNull: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));

vi.mock('../db/index.js', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) }) }) },
}));

vi.mock('../db/schema/index.js', () => ({
  syncDirty: {}, mealPlans: {}, inventoryItems: {}, canonicalFoods: {},
  recipes: {}, recipeIngredients: {}, mealPlanEntries: {},
}));

process.env.WORKER_HMAC_KEY = 'test-secret-key';
const { default: syncRouter } = await import('./sync.js');

function signedRequest(app: express.Express, method: string, path: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = '';
  const sig = crypto.createHmac('sha256', 'test-secret-key').update(`${method}\n${path}\n${timestamp}\n${body}`).digest('hex');
  const req = request(app)[method.toLowerCase() as 'get'](path);
  return req.set('X-Worker-Timestamp', timestamp).set('X-Worker-Signature', sig);
}

describe('sync router', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sync', syncRouter);
  });

  it('GET /pending returns 401 without HMAC', async () => {
    const res = await request(app).get('/api/sync/pending');
    expect(res.status).toBe(401);
  });

  it('GET /pending returns 200 with valid HMAC', async () => {
    const res = await signedRequest(app, 'GET', '/api/sync/pending');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jobs');
  });

  it('rejects requests with stale timestamp (> 5 min old)', async () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400);
    const sig = crypto.createHmac('sha256', 'test-secret-key').update(`GET\n/api/sync/pending\n${oldTimestamp}\n`).digest('hex');
    const res = await request(app)
      .get('/api/sync/pending')
      .set('X-Worker-Timestamp', oldTimestamp)
      .set('X-Worker-Signature', sig);
    expect(res.status).toBe(401);
  });
});
