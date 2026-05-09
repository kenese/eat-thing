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
  sql: Object.assign(() => null, { template: () => null }),
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
  cookEvents: {}, mealPlans: {},
}));

const { default: cookEventsRouter } = await import('./cook-events');

describe('cook-events router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/cook-events', cookEventsRouter);
  });

  it('GET /preview returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/cook-events/preview?mealPlanEntryId=some-id');
    expect(res.status).toBe(401);
  });

  it('GET /preview returns 400 when no mealPlanEntryId or recipeId provided', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app).get('/api/cook-events/preview');
    expect(res.status).toBe(400);
  });

  it('POST returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/cook-events').send({});
    expect(res.status).toBe(401);
  });

  it('POST rejects missing recipeId', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/cook-events')
      .send({ servings: 2, deductions: [], promptResponses: [] });
    expect(res.status).toBe(400);
  });

  it('POST rejects non-positive servings', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/cook-events')
      .send({
        recipeId: '00000000-0000-0000-0000-000000000001',
        servings: 0,
        deductions: [],
        promptResponses: [],
      });
    expect(res.status).toBe(400);
  });
});
