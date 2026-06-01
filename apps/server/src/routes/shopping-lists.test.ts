import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
  selectFrom: vi.fn(),
  selectLimit: vi.fn(),
  updateSet: vi.fn(),
  whereArgs: vi.fn(),
  updateWhereArgs: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock('../auth.js', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (field: unknown, value: unknown) => ({ field, value }),
  asc: () => null,
  desc: () => null,
  inArray: () => null,
  sql: Object.assign((...args: unknown[]) => args, { template: () => null }),
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));
vi.mock('../db/index.js', () => {
  // membershipLimit handles the withHousehold middleware select (limit at end)
  // selectFrom handles any additional select calls (prices, jobs, etc.)
  // selectLimit handles select calls whose cols include a 'candidates' key (PATCH chosen-sku)
  const makeSelectChain = (terminal: () => unknown) => ({
    from: () => ({
      innerJoin: () => ({ where: (args: unknown) => { mocks.whereArgs(args); return terminal(); } }),
      leftJoin: () => ({ where: (args: unknown) => { mocks.whereArgs(args); return { orderBy: () => terminal(), limit: () => terminal() }; } }),
      where: (args: unknown) => {
        mocks.whereArgs(args);
        return {
        orderBy: () => ({ limit: () => terminal() }),
        groupBy: () => terminal(),
        limit: () => terminal(),
        };
      },
      orderBy: () => ({ limit: () => terminal() }),
      limit: () => terminal(),
    }),
  });
  const makeUpdateChain = () => ({
    set: (vals: unknown) => {
      mocks.updateSet(vals);
      return { where: (args: unknown) => { mocks.updateWhereArgs(args); return Promise.resolve(); } };
    },
  });
  return {
    db: {
      select: (cols?: unknown) => {
        // Membership select (withHousehold) — has 'householdId' key
        const isMembershipSelect = cols && typeof cols === 'object' && 'householdId' in (cols as object);
        if (isMembershipSelect) {
          return makeSelectChain(mocks.membershipLimit);
        }
        // Candidates-only select — exactly one key 'candidates' (PATCH chosen-sku endpoint)
        const isCandidatesSelect = cols && typeof cols === 'object' &&
          Object.keys(cols as object).length === 1 && 'candidates' in (cols as object);
        if (isCandidatesSelect) {
          return makeSelectChain(mocks.selectLimit);
        }
        return makeSelectChain(mocks.selectFrom);
      },
      insert: () => ({
        values: (vals: unknown) => {
          const promise = mocks.insertValues(vals);
          return { returning: () => promise ?? Promise.resolve([]) };
        },
      }),
      update: () => makeUpdateChain(),
    },
  };
});
vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlanEntries: {}, recipes: {}, recipeIngredients: {},
  inventoryItems: {}, canonicalFoods: {},
  shoppingLists: {}, shoppingListItems: {},
  scraperJobs: { id: 'id', householdId: 'householdId', type: 'type', createdAt: 'createdAt' },
  shoppingListPrices: { householdId: 'priceHouseholdId', shoppingListItemId: 'shoppingListItemId', store: 'store' },
  supermarketProducts: { householdId: 'householdId', preferred: 'preferred', canonicalFoodId: 'canonicalFoodId', brand: 'brand' },
}));

const { default: shoppingListsRouter } = await import('./shopping-lists');

async function getPrices(listId: string) {
  const app = express();
  app.use(express.json());
  app.use('/api/shopping-lists', shoppingListsRouter);
  return request(app).get(`/api/shopping-lists/${listId}/prices`);
}

async function patchChosenSku(itemId: string, body: { sku?: string }) {
  const app = express();
  app.use(express.json());
  app.use('/api/shopping-lists', shoppingListsRouter);
  return request(app)
    .patch(`/api/shopping-lists/items/${itemId}/chosen-sku`)
    .send(body);
}

async function postSendToCart(listId: string) {
  const app = express();
  app.use(express.json());
  app.use('/api/shopping-lists', shoppingListsRouter);
  return request(app).post(`/api/shopping-lists/${listId}/send-to-cart`);
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

  it('PATCH /items/:id/chosen-sku updates chosenSku when sku is in candidates', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectLimit.mockResolvedValueOnce([{
      candidates: [
        { sku: 'NW001', name: 'Flour 1.5kg', brand: 'Pams', packSize: { qty: 1500, unit: 'g' }, price: 3.99, unitPrice: { value: 0.0027, per: 'g' }, inStock: true, onSpecial: false, cartQty: 1, resolution: 'manual' },
        { sku: 'NW002', name: 'Flour 1kg', brand: 'Edmonds', packSize: { qty: 1000, unit: 'g' }, price: 4.50, unitPrice: { value: 0.0045, per: 'g' }, inStock: true, onSpecial: false, cartQty: 1, resolution: 'manual' },
      ],
    }]);
    const res = await patchChosenSku('00000000-0000-0000-0000-000000000001', { sku: 'NW002' });
    expect(res.status).toBe(200);
    expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      chosenSku: 'NW002',
      sku: 'NW002',
      name: 'Flour 1kg',
      price: '4.5',
    }));
  });

  it('PATCH /items/:id/chosen-sku rejects sku not in candidates', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectLimit.mockResolvedValueOnce([{
      candidates: [{ sku: 'NW001', name: 'Flour 1.5kg', brand: 'Pams', packSize: null, price: 3.99, unitPrice: null, inStock: true, onSpecial: false, cartQty: 1, resolution: 'sole' }],
    }]);
    const res = await patchChosenSku('00000000-0000-0000-0000-000000000001', { sku: 'NW999' });
    expect(res.status).toBe(400);
  });

  it('returns candidates + chosenSku on the prices payload', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectFrom.mockResolvedValueOnce([{ id: '00000000-0000-0000-0000-000000000001' }]);
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

  it('POST /:id/refresh-prices does not enqueue work for a foreign household list', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectFrom.mockResolvedValueOnce([]);
    const res = await request(app).post('/api/shopping-lists/550e8400-e29b-41d4-a716-446655440001/refresh-prices');
    expect(res.status).toBe(404);
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it('GET /:id/prices does not read a foreign household list', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectFrom.mockResolvedValueOnce([]);
    const res = await getPrices('550e8400-e29b-41d4-a716-446655440001');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Shopping list not found' });
  });

  it('GET /:id/prices filters price rows by household_id directly', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectFrom.mockResolvedValueOnce([{ id: 'list-1' }]);
    mocks.selectFrom.mockResolvedValueOnce([]);
    mocks.selectFrom.mockResolvedValueOnce([]);
    const res = await getPrices('550e8400-e29b-41d4-a716-446655440001');
    expect(res.status).toBe(200);
    expect(mocks.whereArgs).toHaveBeenCalledWith(expect.arrayContaining([
      { field: 'priceHouseholdId', value: 'hh-1' },
    ]));
  });

  it('PATCH /items/:id/chosen-sku filters price selection and mutation by household_id directly', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectLimit.mockResolvedValueOnce([{
      candidates: [{ sku: 'NW001', name: 'Flour 1kg', brand: 'Pams', packSize: null, price: 3.99, unitPrice: null, inStock: true, onSpecial: false, cartQty: 1, resolution: 'sole' }],
    }]);
    const res = await patchChosenSku('550e8400-e29b-41d4-a716-446655440011', { sku: 'NW001' });
    expect(res.status).toBe(200);
    expect(mocks.whereArgs).toHaveBeenCalledWith(expect.arrayContaining([
      { field: 'priceHouseholdId', value: 'hh-1' },
    ]));
    expect(mocks.updateWhereArgs).toHaveBeenCalledWith(expect.arrayContaining([
      { field: 'priceHouseholdId', value: 'hh-1' },
    ]));
  });

  it('POST /:id/send-to-cart enqueues add_to_cart with items that have chosenSku', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectFrom.mockResolvedValueOnce([{ id: '550e8400-e29b-41d4-a716-446655440001' }]);
    mocks.selectFrom.mockResolvedValueOnce([
      {
        shoppingListItemId: '550e8400-e29b-41d4-a716-446655440011',
        candidates: [{ sku: 'NW001', cartQty: 1, name: 'X', brand: null, packSize: null, price: 1.99, unitPrice: null, inStock: true, onSpecial: false, resolution: 'sole' }],
        chosenSku: 'NW001',
      },
      {
        shoppingListItemId: '550e8400-e29b-41d4-a716-446655440012',
        candidates: [{ sku: 'NW002', cartQty: 2, name: 'Y', brand: null, packSize: null, price: 2.50, unitPrice: null, inStock: true, onSpecial: false, resolution: 'sole' }],
        chosenSku: 'NW002',
      },
      { shoppingListItemId: '550e8400-e29b-41d4-a716-446655440013', candidates: [], chosenSku: null }, // skipped
    ]);
    mocks.insertValues.mockResolvedValueOnce([{ id: 'job-9' }]);
    const res = await postSendToCart('550e8400-e29b-41d4-a716-446655440001');
    expect(res.status).toBe(200);
    expect(res.body.jobId).toBe('job-9');
    expect(res.body.skipped).toEqual(['550e8400-e29b-41d4-a716-446655440013']);
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
      type: 'add_to_cart',
      payload: expect.objectContaining({
        items: [
          { shoppingListItemId: '550e8400-e29b-41d4-a716-446655440011', sku: 'NW001', qty: 1 },
          { shoppingListItemId: '550e8400-e29b-41d4-a716-446655440012', sku: 'NW002', qty: 2 },
        ],
      }),
    }));
  });

  it('POST /:id/send-to-cart does not enqueue work for a foreign household list', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.selectFrom.mockResolvedValueOnce([]);
    const res = await postSendToCart('550e8400-e29b-41d4-a716-446655440001');
    expect(res.status).toBe(404);
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });
});
