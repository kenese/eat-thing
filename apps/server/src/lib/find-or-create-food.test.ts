import { vi, describe, it, expect, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectResult: [] as { id: string }[],
  insertResult: [{ id: 'new-uuid' }] as { id: string }[],
}));

vi.mock('uuid', () => ({ v4: () => 'new-uuid' }));
vi.mock('../db/index.js', () => {
  const selectChain = {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(mocks.selectResult) }) }),
  };
  const insertChain = {
    values: () => ({ onConflictDoNothing: () => ({ returning: () => Promise.resolve(mocks.insertResult) }) }),
  };
  return { db: { select: () => selectChain, insert: () => insertChain } };
});
vi.mock('../db/schema/index.js', () => ({ canonicalFoods: { id: 'id', name: 'name' } }));
vi.mock('drizzle-orm', () => ({ ilike: () => null, eq: () => null }));

const { findOrCreateFood } = await import('./find-or-create-food.js');

describe('findOrCreateFood', () => {
  beforeEach(() => {
    mocks.selectResult = [];
    mocks.insertResult = [{ id: 'new-uuid' }];
  });

  it('returns existing food id when name matches', async () => {
    mocks.selectResult = [{ id: 'existing-uuid' }];
    const id = await findOrCreateFood('Milk', 'dairy', 'ml');
    expect(id).toBe('existing-uuid');
  });

  it('creates and returns new food id when no match', async () => {
    mocks.selectResult = [];
    const id = await findOrCreateFood('Dish Soap', 'other', 'count');
    expect(id).toBe('new-uuid');
  });
});
