import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { withHousehold } from './with-household';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock('better-auth/node', () => ({
  fromNodeHeaders: (h: unknown) => h,
}));

vi.mock('drizzle-orm', () => ({
  eq: () => null,
}));

vi.mock('../db/index.js', () => ({
  db: { select: mocks.select },
}));

vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
}));

describe('withHousehold middleware', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue([]);
    mocks.where.mockReturnValue({ limit: mocks.limit });
    mocks.from.mockReturnValue({ where: mocks.where });
    mocks.select.mockReturnValue({ from: mocks.from });

    app = express();
    app.use(withHousehold);
    app.get('/test', (req, res) => {
      res.json({ userId: req.userId, householdId: req.householdId });
    });
  });

  it('returns 401 when there is no session', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 403 when the user has no household membership', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.limit.mockResolvedValue([]);
    const res = await request(app).get('/test');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'No household found for this user' });
  });

  it('attaches userId and householdId then calls next', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.limit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'user-1', householdId: 'hh-1' });
  });
});
