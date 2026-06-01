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

vi.mock('better-auth/node', () => ({
  fromNodeHeaders: (h: unknown) => h,
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  ilike: () => null,
  asc: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));

vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

vi.mock('../db/index.js', () => {
  const membershipChain = {
    from: () => ({
      where: () => ({
        limit: mocks.membershipLimit,
      }),
    }),
  };
  return {
    db: {
      select: () => membershipChain,
    },
  };
});

vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  inventoryItems: {},
  canonicalFoods: {},
}));

vi.mock('../lib/find-or-create-food.js', () => ({
  findOrCreateFood: vi.fn(),
}));

const { default: inventoryRouter } = await import('./inventory');

describe('inventory router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/inventory', inventoryRouter);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/inventory').send({
      canonicalFoodId: '00000000-0000-0000-0000-000000000001',
      qty: 1,
      unit: 'g',
    });
    expect(res.status).toBe(401);
  });

  it('rejects POST with a non-canonical unit', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/inventory')
      .send({
        canonicalFoodId: '00000000-0000-0000-0000-000000000001',
        qty: 2,
        unit: 'cups',
      });

    expect(res.status).toBe(400);
  });

  it('rejects PUT with a non-canonical unit', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .put('/api/inventory/item-1')
      .send({ unit: 'oz' });

    expect(res.status).toBe(400);
  });
});
