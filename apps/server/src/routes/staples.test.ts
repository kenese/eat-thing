import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  asc: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));
vi.mock('../db/index.js', () => {
  const chain = { from: () => ({ where: () => ({ limit: mocks.membershipLimit }) }) };
  return { db: { select: () => chain } };
});
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
});
