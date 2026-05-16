import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
}));

vi.mock('../auth.js', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  asc: () => null,
  desc: () => null,
  sql: Object.assign((...args: unknown[]) => args, { template: () => null }),
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));
vi.mock('../db/index.js', () => {
  const chain = { from: () => ({ where: () => ({ limit: mocks.membershipLimit }) }) };
  return { db: { select: () => chain } };
});
vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlanEntries: {}, recipes: {}, recipeIngredients: {},
  inventoryItems: {}, canonicalFoods: {},
  shoppingLists: {}, shoppingListItems: {},
  scraperJobs: { id: 'id' }, shoppingListPrices: {},
}));

const { default: shoppingListsRouter } = await import('./shopping-lists');

describe('shopping-lists router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/shopping-lists', shoppingListsRouter);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/shopping-lists/from-plan').send({});
    expect(res.status).toBe(401);
  });

  it('PUT item rejects non-boolean checked', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .put('/api/shopping-lists/list-id/items/item-id')
      .send({ checked: 'yes' });
    expect(res.status).toBe(400);
  });

  it('POST manual item rejects missing name', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/shopping-lists/list-id/items')
      .send({ qty: 2, unit: 'count' });
    expect(res.status).toBe(400);
  });

  it('POST /:id/refresh-prices returns 401 unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/shopping-lists/list-1/refresh-prices');
    expect(res.status).toBe(401);
  });

  it('GET /:id/prices returns 401 unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/shopping-lists/list-1/prices');
    expect(res.status).toBe(401);
  });

  it('POST /:listId/items/purchase returns 401 unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/shopping-lists/list-1/items/purchase')
      .send({ itemIds: ['item-1'] });
    expect(res.status).toBe(401);
  });

  it('POST /:listId/items/purchase rejects empty itemIds', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/shopping-lists/list-1/items/purchase')
      .send({ itemIds: [] });
    expect(res.status).toBe(400);
  });

  it('POST /:listId/items/batch-delete returns 401 unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/shopping-lists/list-1/items/batch-delete')
      .send({ itemIds: ['item-1'] });
    expect(res.status).toBe(401);
  });

  it('POST /:listId/items/batch-delete rejects empty itemIds', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/shopping-lists/list-1/items/batch-delete')
      .send({ itemIds: [] });
    expect(res.status).toBe(400);
  });

  it('POST manual item requires category when no canonicalFoodId', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/shopping-lists/list-id/items')
      .send({ name: 'Dish soap', qty: 1, unit: 'count' });
    expect(res.status).toBe(400);
  });

  it('rejects from-plan POST with missing entryIds', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/shopping-lists/from-plan')
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects from-plan POST with non-uuid entryIds', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/shopping-lists/from-plan')
      .send({ entryIds: ['not-a-uuid'] });

    expect(res.status).toBe(400);
  });
});
