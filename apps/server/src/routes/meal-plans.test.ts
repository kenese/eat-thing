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
  asc: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));

vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

vi.mock('../db/index.js', () => {
  const membershipChain = {
    from: () => ({ where: () => ({ limit: mocks.membershipLimit }) }),
  };
  return {
    db: { select: () => membershipChain },
  };
});

vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlans: {},
  mealPlanEntries: {},
  recipes: {},
}));

const { default: mealPlansRouter } = await import('./meal-plans');

describe('meal-plans router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/meal-plans', mealPlansRouter);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/meal-plans?weekStart=2026-05-04');
    expect(res.status).toBe(401);
  });

  it('returns 400 when weekStart is missing or malformed', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const noParam = await request(app).get('/api/meal-plans');
    expect(noParam.status).toBe(400);

    const malformed = await request(app).get('/api/meal-plans?weekStart=05-04-2026');
    expect(malformed.status).toBe(400);
  });

  it('rejects POST entry with invalid date format', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/meal-plans/entries')
      .send({
        weekStart: 'not-a-date',
        date: '2026-05-04',
        recipeId: '00000000-0000-0000-0000-000000000001',
        servings: 2,
      });

    expect(res.status).toBe(400);
  });

  it('rejects POST entry with non-positive servings', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/meal-plans/entries')
      .send({
        weekStart: '2026-05-04',
        date: '2026-05-04',
        recipeId: '00000000-0000-0000-0000-000000000001',
        servings: 0,
      });

    expect(res.status).toBe(400);
  });

  it('rejects PUT entry with invalid status', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .put('/api/meal-plans/entries/some-id')
      .send({ status: 'gobbled' });

    expect(res.status).toBe(400);
  });
});
