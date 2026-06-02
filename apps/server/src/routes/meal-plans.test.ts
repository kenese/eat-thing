import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  selectResults: [] as unknown[],
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  deleteWhere: vi.fn(),
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
  gte: () => null,
  lte: () => null,
  asc: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));

vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

vi.mock('../db/index.js', () => {
  const nextSelectResult = () => Promise.resolve(mocks.selectResults.shift() ?? []);

  const makeSelectChain = () => ({
    from: () => ({
      where: () => ({
        limit: () => nextSelectResult(),
      }),
      innerJoin: () => ({
        where: () => ({
          limit: () => nextSelectResult(),
        }),
      }),
    }),
  });

  return {
    db: {
      select: () => makeSelectChain(),
      insert: () => ({
        values: (vals: unknown) => {
          mocks.insertValues(vals);
          return Promise.resolve();
        },
      }),
      update: () => ({
        set: (vals: unknown) => {
          mocks.updateSet(vals);
          return { where: (args: unknown) => { mocks.updateWhere(args); return Promise.resolve(); } };
        },
      }),
      delete: () => ({
        where: (args: unknown) => {
          mocks.deleteWhere(args);
          return Promise.resolve();
        },
      }),
    },
  };
});

vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlanEntries: { id: 'id', householdId: 'householdId', date: 'date', recipeId: 'recipeId' },
  recipes: { householdId: 'householdId', id: 'id' },
}));

const { default: mealPlansRouter } = await import('./meal-plans');

describe('meal-plans router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectResults.splice(0, mocks.selectResults.length);
    app = express();
    app.use(express.json());
    app.use('/api/meal-plans', mealPlansRouter);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/meal-plans/entries?from=2026-05-14&to=2026-05-30');
    expect(res.status).toBe(401);
  });

  it('returns 400 when from/to are missing or malformed', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.selectResults.push([{ householdId: 'hh-1' }], [{ householdId: 'hh-1' }]);

    const noParams = await request(app).get('/api/meal-plans/entries');
    expect(noParams.status).toBe(400);

    const malformed = await request(app).get('/api/meal-plans/entries?from=2026-05-14&to=not-a-date');
    expect(malformed.status).toBe(400);
  });

  it('rejects POST entry with invalid date format', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.selectResults.push([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/meal-plans/entries')
      .send({
        date: 'not-a-date',
        recipeId: '00000000-0000-0000-0000-000000000001',
        servings: 2,
      });

    expect(res.status).toBe(400);
  });

  it('rejects POST entry with non-positive servings', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.selectResults.push([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/meal-plans/entries')
      .send({
        date: '2026-05-04',
        recipeId: '00000000-0000-0000-0000-000000000001',
        servings: 0,
      });

    expect(res.status).toBe(400);
  });

  it('rejects POST when the day already has four recipes', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.selectResults.push(
      [{ householdId: 'hh-1' }],
      [{ householdId: 'hh-1' }],
      Array.from({ length: 4 }, (_, i) => ({ id: `entry-${i + 1}` })),
    );

    const res = await request(app)
      .post('/api/meal-plans/entries')
      .send({
        date: '2026-05-14',
        recipeId: '00000000-0000-0000-0000-000000000001',
        servings: 2,
      });

    expect(res.status).toBe(409);
  });

  it('rejects PUT entry with invalid status', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.selectResults.push([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .put('/api/meal-plans/entries/some-id')
      .send({ status: 'gobbled' });

    expect(res.status).toBe(400);
  });

  it('rejects moving an entry onto a full day', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.selectResults.push(
      [{ householdId: 'hh-1' }],
      [{ id: 'entry-1', householdId: 'hh-1', date: '2026-05-13' }],
      Array.from({ length: 4 }, (_, i) => ({ id: `target-${i + 1}` })),
    );

    const res = await request(app)
      .put('/api/meal-plans/entries/entry-1')
      .send({ date: '2026-05-14' });

    expect(res.status).toBe(409);
  });
});
