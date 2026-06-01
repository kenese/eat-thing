import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mockedSchema = {
  recipes: { __name: 'recipes' },
  recipeIngredients: { __name: 'recipeIngredients' },
  canonicalFoods: { __name: 'canonicalFoods' },
};

const RECIPE_ID = '00000000-0000-0000-0000-000000000123';

const state = vi.hoisted(() => ({
  insertedRecipes: [] as Record<string, unknown>[],
  insertedIngredients: [] as Record<string, unknown>[][],
  updatedRecipes: [] as Record<string, unknown>[],
  deletedIngredientRecipeIds: [] as unknown[],
  recipeAfterWrite: null as Record<string, unknown> | null,
  existingRecipe: null as Record<string, unknown> | null,
  loadedIngredients: [] as Record<string, unknown>[],
}));

vi.mock('../middleware/with-household.js', () => ({
  withHousehold: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { householdId: string }).householdId = 'hh-1';
    next();
  },
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: (left: unknown, right: unknown) => ({ left, right }),
  ilike: () => null,
  asc: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));

vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

vi.mock('../db/schema/index.js', () => mockedSchema);

vi.mock('../lib/supabase-storage.js', () => ({
  uploadPhoto: vi.fn(),
}));

vi.mock('../db/index.js', () => {
  const recipeInsertChain = {
    values: vi.fn(async (values: Record<string, unknown>) => {
      state.insertedRecipes.push(values);
    }),
  };

  const ingredientInsertChain = {
    values: vi.fn(async (values: Record<string, unknown>[]) => {
      state.insertedIngredients.push(values);
    }),
  };

  const updateChain = {
    set: vi.fn((values: Record<string, unknown>) => {
      state.updatedRecipes.push(values);
      return {
        where: vi.fn(async () => {}),
      };
    }),
  };

  const ingredientDeleteChain = {
    where: vi.fn(async (clause: { right: unknown }) => {
      state.deletedIngredientRecipeIds.push(clause.right);
    }),
  };

  return {
    db: {
      select: vi.fn(() => ({
        from: (table: unknown) => {
          if (table === mockedSchema.recipes) {
            const rows = state.recipeAfterWrite ? [state.recipeAfterWrite] : [];
            return {
              where: () => ({
                limit: async () => state.existingRecipe ? [state.existingRecipe] : [],
                then: (resolve: (value: typeof rows) => unknown, reject?: (reason?: unknown) => unknown) =>
                  Promise.resolve(rows).then(resolve, reject),
              }),
            };
          }

          if (table === mockedSchema.recipeIngredients) {
            return {
              innerJoin: () => ({
                where: () => ({
                  orderBy: async () => state.loadedIngredients,
                }),
              }),
            };
          }

          return {
            where: () => ({
              limit: async () => [],
            }),
          };
        },
      })),
      transaction: vi.fn(async (callback: (tx: {
        insert: (table: unknown) => typeof recipeInsertChain | typeof ingredientInsertChain;
        update: () => typeof updateChain;
        delete: () => typeof ingredientDeleteChain;
      }) => Promise<void>) => {
        await callback({
          insert: (table: unknown) => table === mockedSchema.recipes ? recipeInsertChain : ingredientInsertChain,
          update: () => updateChain,
          delete: () => ingredientDeleteChain,
        });
      }),
    },
  };
});

const { default: recipesRouter } = await import('./recipes');

describe('recipes router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    state.insertedRecipes.length = 0;
    state.insertedIngredients.length = 0;
    state.updatedRecipes.length = 0;
    state.deletedIngredientRecipeIds.length = 0;
    state.recipeAfterWrite = {
      id: 'fixed-uuid',
      householdId: 'hh-1',
      name: 'Recipe',
      servings: 4,
      sourceUrl: null,
      sourceImage: null,
      instructions: null,
      totalTimeMinutes: null,
      tags: [],
    };
    state.existingRecipe = {
      id: 'fixed-uuid',
      householdId: 'hh-1',
    };
    state.loadedIngredients = [];

    app = express();
    app.use(express.json());
    app.use('/api/recipes', recipesRouter);
  });

  it('returns 400 when POST body is invalid', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .send({ name: '', servings: -1, ingredients: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  it('rejects POST with no ingredients', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .send({ name: 'Test', servings: 4, ingredients: [] });

    expect(res.status).toBe(400);
  });

  it('rejects ingredient with blank qty', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Test',
        servings: 4,
        ingredients: [{ canonicalFoodId: '00000000-0000-0000-0000-000000000001', qty: '', unit: 'g' }],
      });

    expect(res.status).toBe(400);
  });

  it('rejects numeric ingredient qty because recipe quantities are stored as display strings', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Test',
        servings: 4,
        ingredients: [{ canonicalFoodId: '00000000-0000-0000-0000-000000000001', qty: 1, unit: 'cups' }],
      });

    expect(res.status).toBe(400);
  });

  it('persists totalTimeMinutes and tags on create', async () => {
    state.recipeAfterWrite = {
      id: 'fixed-uuid',
      householdId: 'hh-1',
      name: 'Test',
      servings: 4,
      sourceUrl: null,
      sourceImage: null,
      instructions: null,
      totalTimeMinutes: 25,
      tags: ['quick'],
    };

    const res = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Test',
        servings: 4,
        totalTimeMinutes: 25,
        tags: ['quick'],
        ingredients: [{ canonicalFoodId: '00000000-0000-0000-0000-000000000001', qty: '1', unit: '' }],
      });

    expect(res.status).toBe(201);
    expect(state.insertedRecipes[0]).toMatchObject({
      id: 'fixed-uuid',
      householdId: 'hh-1',
      name: 'Test',
      servings: 4,
      totalTimeMinutes: 25,
      tags: ['quick'],
    });
  });

  it('persists totalTimeMinutes and tags on update', async () => {
    const res = await request(app)
      .put(`/api/recipes/${RECIPE_ID}`)
      .send({
        totalTimeMinutes: 45,
        tags: ['make-ahead', 'family'],
        ingredients: [{ canonicalFoodId: '00000000-0000-0000-0000-000000000001', qty: '2', unit: '' }],
      });

    expect(res.status).toBe(200);
    expect(state.updatedRecipes[0]).toMatchObject({
      totalTimeMinutes: 45,
      tags: ['make-ahead', 'family'],
    });
  });
});
