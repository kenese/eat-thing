import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
  selectQueue: [] as unknown[],
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  dbUpdate: vi.fn(),
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
      select: vi.fn(() => mocks.selectQueue.shift() ?? membershipChain),
      update: mocks.dbUpdate,
    },
  };
});

vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  inventoryItems: {
    id: 'inventoryItems.id',
    householdId: 'inventoryItems.householdId',
    canonicalFoodId: 'inventoryItems.canonicalFoodId',
    qty: 'inventoryItems.qty',
    unit: 'inventoryItems.unit',
    brand: 'inventoryItems.brand',
    purchasedAt: 'inventoryItems.purchasedAt',
    expiresAt: 'inventoryItems.expiresAt',
    createdAt: 'inventoryItems.createdAt',
    updatedAt: 'inventoryItems.updatedAt',
  },
  canonicalFoods: {
    id: 'canonicalFoods.id',
    name: 'canonicalFoods.name',
    category: 'canonicalFoods.category',
  },
}));

vi.mock('../lib/find-or-create-food.js', () => ({
  findExistingFoodOrRequireReview: vi.fn(),
}));

const { findExistingFoodOrRequireReview } = await import('../lib/find-or-create-food.js');

const { default: inventoryRouter } = await import('./inventory');

describe('inventory router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectQueue = [];
    mocks.dbUpdate.mockReturnValue({
      set: mocks.updateSet.mockReturnValue({
        where: mocks.updateWhere.mockResolvedValue(undefined),
      }),
    });
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

  it('returns taxonomy review required for a brand-new manual food', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    vi.mocked(findExistingFoodOrRequireReview).mockResolvedValue({
      kind: 'review',
      proposed: { name: 'Dish Soap', category: 'other', defaultUnit: 'count' },
      matches: [{ id: 'food-1', name: 'Dish soap', category: 'other', defaultUnit: 'count' }],
    });

    const res = await request(app)
      .post('/api/inventory')
      .send({
        foodName: 'Dish Soap',
        category: 'other',
        qty: 1,
        unit: 'count',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('taxonomy_review_required');
    expect(res.body.proposed).toEqual({ name: 'Dish Soap', category: 'other', defaultUnit: 'count' });
    expect(res.body.matches).toHaveLength(1);
  });

  it('updates the canonical food category when an inventory item category changes', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectQueue = [
      {
        from: () => ({
          where: () => ({
            limit: mocks.membershipLimit,
          }),
        }),
      },
      {
        from: () => ({
          where: () => ({
            limit: vi.fn().mockResolvedValue([{
              householdId: 'hh-1',
              canonicalFoodId: 'food-1',
            }]),
          }),
        }),
      },
      {
        from: () => ({
          innerJoin: () => ({
            where: () => Promise.resolve([{
              id: 'item-1',
              householdId: 'hh-1',
              canonicalFoodId: 'food-1',
              foodName: 'firm tofu',
              category: 'pantry',
              qty: 2,
              unit: 'count',
              brand: null,
              purchasedAt: null,
              expiresAt: null,
              createdAt: new Date('2026-06-09T00:00:00.000Z'),
              updatedAt: new Date('2026-06-09T00:00:00.000Z'),
            }]),
          }),
        }),
      },
    ];

    const res = await request(app)
      .put('/api/inventory/item-1')
      .send({ qty: 2, unit: 'count', category: 'pantry' });

    expect(res.status).toBe(200);
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ category: 'pantry' }));
  });
});
