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
  // Membership lookup → returns one row so withHousehold passes.
  const membershipChain = {
    from: () => ({ where: () => ({ limit: mocks.membershipLimit }) }),
  };
  return {
    db: {
      select: () => membershipChain,
    },
  };
});

vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  recipes: {},
  recipeIngredients: {},
  canonicalFoods: {},
}));

const { default: recipesRouter } = await import('./recipes');

describe('recipes router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/recipes', recipesRouter);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/recipes');
    expect(res.status).toBe(401);
  });

  it('returns 400 when POST body is invalid', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/recipes')
      .send({ name: '', servings: -1, ingredients: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  it('rejects POST with no ingredients', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/recipes')
      .send({ name: 'Test', servings: 4, ingredients: [] });

    expect(res.status).toBe(400);
  });

  it('rejects ingredient with blank qty', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

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
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/recipes')
      .send({
        name: 'Test',
        servings: 4,
        ingredients: [{ canonicalFoodId: '00000000-0000-0000-0000-000000000001', qty: 1, unit: 'cups' }],
      });

    expect(res.status).toBe(400);
  });
});
