import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
  listLowStockStaples: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (field: unknown, value: unknown) => ({ field, value }),
  asc: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));
vi.mock('../db/index.js', () => {
  const makeAwaitable = (terminal: () => unknown) => Object.assign(Promise.resolve(terminal()), {
    orderBy: () => terminal(),
    limit: () => terminal(),
  });
  const makeSelectChain = (terminal: () => unknown) => ({
    from: () => ({
      innerJoin: () => ({
        where: () => makeAwaitable(terminal),
      }),
      where: () => ({ limit: mocks.membershipLimit }),
    }),
  });
  return { db: { select: (cols?: unknown) => {
    const isMembershipSelect = cols && typeof cols === 'object' && 'householdId' in (cols as object)
      && Object.keys(cols as object).length === 1;
    return makeSelectChain(isMembershipSelect ? mocks.membershipLimit : mocks.listLowStockStaples);
  } } };
});
vi.mock('../lib/low-stock-staples.js', () => ({
  listLowStockStaples: mocks.listLowStockStaples,
}));
vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  staples: {},
  canonicalFoods: {},
}));

const { default: staplesRouter } = await import('./staples');

describe('staples router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/staples', staplesRouter);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/staples');
    expect(res.status).toBe(401);
  });

  it('POST rejects missing canonicalFoodId', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app).post('/api/staples').send({ thresholdQty: 500, thresholdUnit: 'g' });
    expect(res.status).toBe(400);
  });

  it('POST rejects non-positive thresholdQty', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/staples')
      .send({ canonicalFoodId: '00000000-0000-0000-0000-000000000001', thresholdQty: 0, thresholdUnit: 'g' });
    expect(res.status).toBe(400);
  });

  it('POST rejects invalid thresholdUnit', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/staples')
      .send({ canonicalFoodId: '00000000-0000-0000-0000-000000000001', thresholdQty: 500, thresholdUnit: 'oz' });
    expect(res.status).toBe(400);
  });

  it('PUT rejects invalid thresholdUnit', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app).put('/api/staples/some-id').send({ thresholdUnit: 'lb' });
    expect(res.status).toBe(400);
  });

  it('GET /low-stock returns the derived low-stock staples for the household', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.listLowStockStaples.mockResolvedValueOnce([
      {
        id: 'staple-1',
        householdId: 'hh-1',
        canonicalFoodId: 'food-1',
        foodName: 'Rice',
        thresholdQty: 1000,
        thresholdUnit: 'g',
        currentQty: 250,
        neededQty: 750,
      },
    ]);

    const res = await request(app).get('/api/staples/low-stock');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 'staple-1',
        householdId: 'hh-1',
        canonicalFoodId: 'food-1',
        foodName: 'Rice',
        thresholdQty: 1000,
        thresholdUnit: 'g',
        currentQty: 250,
        neededQty: 750,
      },
    ]);
    expect(mocks.listLowStockStaples).toHaveBeenCalledWith('hh-1');
  });
});
