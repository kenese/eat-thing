import { vi, describe, it, expect, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectResult: [] as Array<{ id: string; name?: string; defaultUnit?: string; category?: string | null }>,
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

const { findExistingFoodOrRequireReview } = await import('./find-or-create-food.js');

describe('findExistingFoodOrRequireReview', () => {
  beforeEach(() => {
    mocks.selectResult = [];
    mocks.insertResult = [{ id: 'new-uuid' }];
  });

  it('returns existing food id when name matches', async () => {
    mocks.selectResult = [{ id: 'existing-uuid', name: 'Milk', defaultUnit: 'ml', category: 'dairy' }];
    const result = await findExistingFoodOrRequireReview('Milk', 'dairy', 'ml');
    expect(result).toEqual({ kind: 'existing', id: 'existing-uuid' });
  });

  it('requires taxonomy review when there is no exact match', async () => {
    mocks.selectResult = [];
    const result = await findExistingFoodOrRequireReview('Dish Soap', 'other', 'count');
    expect(result).toEqual({
      kind: 'review',
      proposed: {
        name: 'Dish Soap',
        category: 'other',
        defaultUnit: 'count',
      },
      matches: [],
    });
  });

  it('includes suggested matches when similar canonical foods exist', async () => {
    mocks.selectResult = [
      { id: 'match-1', name: 'Dish soap', defaultUnit: 'count', category: 'other' },
      { id: 'match-2', name: 'Hand soap', defaultUnit: 'count', category: 'other' },
    ];
    const result = await findExistingFoodOrRequireReview('Soap', 'other', 'count');
    expect(result).toEqual({
      kind: 'review',
      proposed: {
        name: 'Soap',
        category: 'other',
        defaultUnit: 'count',
      },
      matches: [
        { id: 'match-1', name: 'Dish soap', defaultUnit: 'count', category: 'other' },
        { id: 'match-2', name: 'Hand soap', defaultUnit: 'count', category: 'other' },
      ],
    });
  });
});
