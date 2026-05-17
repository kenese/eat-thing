import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
  selectFrom: vi.fn(),
}));

vi.mock('../auth.js', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  asc: () => null,
  desc: () => null,
  inArray: () => null,
  sql: Object.assign((...args: unknown[]) => args, { template: () => null }),
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));
vi.mock('../db/index.js', () => {
  // membershipLimit handles the withHousehold middleware select (limit at end)
  // selectFrom handles any additional select calls (prices, jobs, etc.)
  const makeSelectChain = (terminal: () => unknown) => ({
    from: () => ({
      innerJoin: () => ({ where: () => terminal() }),
      leftJoin: () => ({ where: () => ({ orderBy: () => terminal(), limit: () => terminal() }) }),
      where: () => ({
        orderBy: () => ({ limit: () => terminal() }),
        groupBy: () => terminal(),
        limit: () => terminal(),
      }),
      orderBy: () => ({ limit: () => terminal() }),
      limit: () => terminal(),
    }),
  });
  return {
    db: {
      select: (cols?: unknown) => {
        // Membership select (withHousehold) can be distinguished by the presence of 'householdId' key in cols
        // But since cols are mocked schema objects, use membershipLimit for the chain that ends in limit(1)
        // We use a single makeSelectChain but route the terminal differently based on call sequence.
        // Simplest: always use selectFrom as the terminal; set membershipLimit as a specific mock for this chain.
        const isMembershipSelect = cols && typeof cols === 'object' && 'householdId' in (cols as object);
        if (isMembershipSelect) {
          return makeSelectChain(mocks.membershipLimit);
        }
        return makeSelectChain(mocks.selectFrom);
      },
    },
  };
});
vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlanEntries: {}, recipes: {}, recipeIngredients: {},
  inventoryItems: {}, canonicalFoods: {},
  shoppingLists: {}, shoppingListItems: {},
  scraperJobs: { id: 'id', householdId: 'householdId', type: 'type', createdAt: 'createdAt' },
  shoppingListPrices: { shoppingListItemId: 'shoppingListItemId', store: 'store' },
  supermarketProducts: { householdId: 'householdId', preferred: 'preferred', canonicalFoodId: 'canonicalFoodId', brand: 'brand' },
}));

const { default: shoppingListsRouter } = await import('./shopping-lists');

async function getPrices(listId: string) {
  const app = express();
  app.use(express.json());
  app.use('/api/shopping-lists', shoppingListsRouter);
  return request(app).get(`/api/shopping-lists/${listId}/prices`);
}

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

  it('returns candidates + chosenSku on the prices payload', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectFrom.mockResolvedValueOnce([
      {
        id: 'p-1',
        shoppingListItemId: 'sli-1',
        store: 'new_world',
        sku: 'NW001',
        name: 'Flour 1.5kg',
        price: '3.99',
        inStock: true,
        matched: true,
        candidates: [{ sku: 'NW001', name: 'Flour 1.5kg', brand: 'Pams', packSize: { qty: 1500, unit: 'g' }, price: 3.99, unitPrice: { value: 0.0027, per: 'g' }, inStock: true, onSpecial: false, cartQty: 1, resolution: 'sole' }],
        chosenSku: 'NW001',
        checkedAt: new Date('2026-05-18T00:00:00Z'),
      },
    ]);
    mocks.selectFrom.mockResolvedValueOnce([]); // no jobs
    const res = await getPrices('00000000-0000-0000-0000-000000000001');
    expect(res.body.prices[0].candidates).toHaveLength(1);
    expect(res.body.prices[0].chosenSku).toBe('NW001');
  });
});
