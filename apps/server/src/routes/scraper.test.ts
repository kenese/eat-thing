import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';

const mocks = vi.hoisted(() => ({
  insertReturning: vi.fn(),
  insertValues: vi.fn(),
  selectLimit: vi.fn(),
  selectMany: vi.fn(),
  updateReturning: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  desc: () => null,
  sql: Object.assign((...args: unknown[]) => args, { template: () => null }),
}));

vi.mock('../db/index.js', () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({ returning: mocks.insertReturning }),
        returning: mocks.insertReturning,
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: mocks.selectMany }),
          limit: mocks.selectLimit,
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: mocks.updateReturning,
        }),
      }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      insert: () => ({
        values: (vals: unknown) => {
          mocks.insertValues(vals);
          return { onConflictDoUpdate: () => Promise.resolve(), returning: () => Promise.resolve([]) };
        },
      }),
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    }),
  },
}));

vi.mock('../db/schema/index.js', () => ({
  supermarketCredentials: { householdId: 'householdId', store: 'store' },
  supermarketProducts: { householdId: 'householdId', store: 'store', sku: 'sku' },
  scraperJobs: { id: 'id', status: 'status', attempts: 'attempts', createdAt: 'createdAt' },
  shoppingListPrices: { shoppingListItemId: 'shoppingListItemId', store: 'store' },
  shoppingListItems: {}, canonicalFoods: {},
  memberships: { householdId: 'householdId', userId: 'userId' },
}));

vi.mock('../auth.js', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));

process.env.SCRAPER_HMAC_SECRET = 'test-secret-key';
const { default: scraperRouter } = await import('./scraper.js');

function sign(method: string, path: string, body = '') {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', 'test-secret-key')
    .update(`${method}\n${path}\n${timestamp}\n${body}`)
    .digest('hex');
  return { 'X-Worker-Timestamp': timestamp, 'X-Worker-Signature': sig };
}

describe('scraper router — session endpoints', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/scraper', scraperRouter);
  });

  it('POST /session rejects without HMAC', async () => {
    const res = await request(app).post('/api/scraper/session').send({ householdId: 'h', store: 'new_world', encryptedBlob: 'x' });
    expect(res.status).toBe(401);
  });

  it('POST /session validates body shape', async () => {
    const body = JSON.stringify({ householdId: 'h' });
    const res = await request(app).post('/api/scraper/session').set(sign('POST', '/api/scraper/session', body)).type('json').send(body);
    expect(res.status).toBe(400);
  });

  it('POST /session upserts and returns ok', async () => {
    mocks.insertReturning.mockResolvedValue([{ id: 'cred-1' }]);
    const body = JSON.stringify({ householdId: 'h', store: 'new_world', encryptedBlob: 'blob' });
    const res = await request(app).post('/api/scraper/session').set(sign('POST', '/api/scraper/session', body)).type('json').send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /session/:hh/:store 404s when missing', async () => {
    mocks.selectLimit.mockResolvedValue([]);
    const path = '/api/scraper/session/h/new_world';
    const res = await request(app).get(path).set(sign('GET', path));
    expect(res.status).toBe(404);
  });

  it('GET /session/:hh/:store returns the envelope when present', async () => {
    mocks.selectLimit.mockResolvedValue([{ encryptedSessionBlob: 'blob', lastLoginAt: new Date('2026-05-10T00:00:00Z') }]);
    const path = '/api/scraper/session/h/new_world';
    const res = await request(app).get(path).set(sign('GET', path));
    expect(res.status).toBe(200);
    expect(res.body.encryptedBlob).toBe('blob');
  });
});

describe('scraper router — jobs', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/scraper', scraperRouter);
  });

  it('GET /jobs/pending returns 401 without HMAC', async () => {
    const res = await request(app).get('/api/scraper/jobs/pending');
    expect(res.status).toBe(401);
  });

  it('GET /jobs/pending returns the pending jobs list', async () => {
    mocks.selectMany.mockResolvedValue([
      { id: 'job-1', householdId: 'h', store: 'new_world', type: 'compare_prices', payload: { shoppingListId: 's1' }, status: 'pending', attempts: 0, createdAt: new Date() },
    ]);
    const res = await request(app).get('/api/scraper/jobs/pending').set(sign('GET', '/api/scraper/jobs/pending'));
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0].id).toBe('job-1');
  });

  it('POST /jobs/:id/claim marks the job in_progress', async () => {
    mocks.updateReturning.mockResolvedValue([{ id: 'job-1' }]);
    const res = await request(app).post('/api/scraper/jobs/job-1/claim').set(sign('POST', '/api/scraper/jobs/job-1/claim'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('POST /jobs/:id/result with ok=true marks done', async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 'job-1', type: 'compare_prices', householdId: 'h', store: 'new_world' }]);
    mocks.updateReturning.mockResolvedValue([{ id: 'job-1' }]);
    const body = JSON.stringify({ ok: true, data: { items: [] } });
    const res = await request(app)
      .post('/api/scraper/jobs/job-1/result')
      .set(sign('POST', '/api/scraper/jobs/job-1/result', body))
      .type('json').send(body);
    expect(res.status).toBe(200);
  });

  it('POST /jobs/:id/result with ok=false records failure', async () => {
    mocks.selectLimit.mockResolvedValue([{ id: 'job-1', type: 'compare_prices', householdId: 'h', store: 'new_world' }]);
    mocks.updateReturning.mockResolvedValue([{ id: 'job-1' }]);
    const body = JSON.stringify({ ok: false, error: 'session_expired' });
    const res = await request(app)
      .post('/api/scraper/jobs/job-1/result')
      .set(sign('POST', '/api/scraper/jobs/job-1/result', body))
      .type('json').send(body);
    expect(res.status).toBe(200);
  });

  it('writes candidates + chosenSku for each item when compare_prices completes', async () => {
    mocks.selectLimit.mockResolvedValueOnce([{ id: 'job-1', type: 'compare_prices', householdId: 'h', store: 'new_world' }]);

    const body = {
      ok: true,
      data: {
        items: [
          {
            shoppingListItemId: 'sli-1',
            candidates: [
              {
                sku: 'NW001', name: 'Flour 1.5kg', brand: 'Pams',
                packSize: { qty: 1500, unit: 'g' }, price: 3.99,
                unitPrice: { value: 0.0027, per: 'g' },
                inStock: true, onSpecial: false, cartQty: 1, resolution: 'sole',
              },
            ],
            chosenSku: 'NW001',
          },
        ],
      },
    };
    const bodyStr = JSON.stringify(body);
    const res = await request(app)
      .post('/api/scraper/jobs/job-1/result')
      .set(sign('POST', '/api/scraper/jobs/job-1/result', bodyStr))
      .type('json').send(bodyStr);
    expect(res.status).toBe(200);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      shoppingListItemId: 'sli-1',
      sku: 'NW001',
      chosenSku: 'NW001',
      candidates: body.data.items[0]!.candidates,
    }));
  });

  it('POST /import-past-orders returns 401 unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/scraper/import-past-orders').send({ store: 'new_world' });
    expect(res.status).toBe(401);
  });
});
