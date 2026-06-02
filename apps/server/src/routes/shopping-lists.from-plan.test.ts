import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
  selectFrom: vi.fn(),
  txInsertValues: vi.fn(),
  txDeleteWhere: vi.fn(),
  listLowStockStaples: vi.fn(),
}));

vi.mock('../auth.js', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (field: unknown, value: unknown) => ({ field, value }),
  asc: () => null,
  desc: () => null,
  inArray: (field: unknown, value: unknown) => ({ field, value }),
  sql: Object.assign((...args: unknown[]) => args, { template: () => null }),
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));
vi.mock('../lib/low-stock-staples.js', () => ({
  listLowStockStaples: mocks.listLowStockStaples,
}));
vi.mock('../db/index.js', () => {
  const makeAwaitable = (terminal: () => unknown) => Object.assign(Promise.resolve(terminal()), {
    orderBy: () => ({ limit: () => terminal() }),
    groupBy: () => terminal(),
    limit: () => terminal(),
  });
  const makeSelectChain = (terminal: () => unknown) => ({
    from: () => ({
      innerJoin: () => ({ innerJoin: () => ({ innerJoin: () => ({ where: () => terminal() }) }) }),
      leftJoin: () => ({ where: () => ({ orderBy: () => terminal() }) }),
      where: () => makeAwaitable(terminal),
    }),
  });

  return {
    db: {
      select: (cols?: unknown) => {
        const isMembershipSelect = cols && typeof cols === 'object' && 'householdId' in (cols as object)
          && Object.keys(cols as object).length === 1;
        return makeSelectChain(isMembershipSelect ? mocks.membershipLimit : mocks.selectFrom);
      },
      transaction: async (callback: (tx: {
        select: (cols?: unknown) => ReturnType<typeof makeSelectChain>;
        insert: () => { values: (vals: unknown) => Promise<void> };
        delete: () => { where: (args: unknown) => Promise<void> };
      }) => Promise<unknown>) => callback({
        select: () => makeSelectChain(mocks.selectFrom),
        insert: () => ({
          values: async (vals: unknown) => {
            mocks.txInsertValues(vals);
          },
        }),
        delete: () => ({
          where: async (args: unknown) => {
            mocks.txDeleteWhere(args);
          },
        }),
      }),
    },
  };
});
vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlanEntries: { householdId: 'mealPlanHouseholdId', id: 'mealPlanId', recipeId: 'mealPlanRecipeId', servings: 'mealPlanServings' },
  recipes: { id: 'recipeId', servings: 'recipeServings', name: 'recipeName' },
  recipeIngredients: { canonicalFoodId: 'ingredientFoodId', unit: 'ingredientUnit', qty: 'ingredientQty', recipeId: 'ingredientRecipeId', optional: 'ingredientOptional' },
  inventoryItems: { canonicalFoodId: 'inventoryFoodId', unit: 'inventoryUnit', qty: 'inventoryQty', householdId: 'inventoryHouseholdId' },
  canonicalFoods: { id: 'foodId', name: 'foodName', densityGPerMl: 'densityGPerMl', countToGrams: 'countToGrams', category: 'category' },
  shoppingLists: { id: 'shoppingListId', householdId: 'shoppingListHouseholdId', createdAt: 'shoppingListCreatedAt', finalizedAt: 'shoppingListFinalizedAt' },
  shoppingListItems: {
    id: 'itemId',
    shoppingListId: 'itemShoppingListId',
    householdId: 'itemHouseholdId',
    canonicalFoodId: 'itemCanonicalFoodId',
    name: 'itemName',
    qty: 'itemQty',
    unit: 'itemUnit',
    source: 'itemSource',
    checked: 'itemChecked',
    sourceRecipeNames: 'itemSourceRecipeNames',
    sourceRecipeId: 'itemSourceRecipeId',
  },
  scraperJobs: { id: 'jobId', householdId: 'jobHouseholdId', type: 'jobType', createdAt: 'jobCreatedAt' },
  shoppingListPrices: { householdId: 'priceHouseholdId', shoppingListItemId: 'shoppingListItemId', store: 'store' },
  supermarketProducts: { householdId: 'householdId', preferred: 'preferred', canonicalFoodId: 'canonicalFoodId', brand: 'brand' },
}));

const { default: shoppingListsRouter } = await import('./shopping-lists');

describe('shopping-lists from-plan', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectFrom.mockResolvedValue([]);
    app = express();
    app.use(express.json());
    app.use('/api/shopping-lists', shoppingListsRouter);
  });

  it('replaces recipe and staple items while preserving manual items', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    mocks.listLowStockStaples.mockResolvedValueOnce([
      {
        id: 'staple-1',
        householdId: 'hh-1',
        canonicalFoodId: 'food-rice',
        foodName: 'Rice',
        thresholdQty: 1000,
        thresholdUnit: 'g',
        currentQty: 250,
        neededQty: 750,
      },
    ]);
    mocks.selectFrom
      .mockResolvedValueOnce([]) // raw ingredients
      .mockResolvedValueOnce([]) // inventory rows
      .mockResolvedValueOnce([{ id: 'list-1' }]) // existing list in transaction
      .mockResolvedValueOnce([
        { id: 'list-1', householdId: 'hh-1', createdAt: '2026-06-02T00:00:00.000Z', finalizedAt: null },
      ]) // final list fetch
      .mockResolvedValueOnce([
        {
          id: 'manual-1',
          shoppingListId: 'list-1',
          canonicalFoodId: 'food-manual',
          name: 'Soap',
          qty: 1,
          unit: 'count',
          source: 'manual',
          checked: false,
          category: 'other',
          sourceRecipeNames: null,
          sourceRecipeId: null,
        },
        {
          id: 'fixed-uuid',
          shoppingListId: 'list-1',
          canonicalFoodId: 'food-rice',
          name: 'Rice',
          qty: 750,
          unit: 'g',
          source: 'staple',
          checked: false,
          category: 'pantry',
          sourceRecipeNames: null,
          sourceRecipeId: null,
        },
      ]);

    const res = await request(app)
      .post('/api/shopping-lists/from-plan')
      .send({ entryIds: [] });

    expect(res.status).toBe(200);
    expect(mocks.listLowStockStaples).toHaveBeenCalledWith('hh-1');
    expect(mocks.txDeleteWhere).toHaveBeenCalledWith(expect.arrayContaining([
      { field: 'itemShoppingListId', value: 'list-1' },
      { field: 'itemHouseholdId', value: 'hh-1' },
      { field: 'itemSource', value: ['recipe', 'staple'] },
    ]));
    expect(mocks.txInsertValues).toHaveBeenCalledWith([
      expect.objectContaining({
        shoppingListId: 'list-1',
        householdId: 'hh-1',
        canonicalFoodId: 'food-rice',
        name: 'Rice',
        qty: 750,
        unit: 'g',
        source: 'staple',
      }),
    ]);
  });
});
