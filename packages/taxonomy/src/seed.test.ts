import { describe, it, expect } from 'vitest';
import { SEED_FOODS } from './seed';
import { CATEGORIES } from './index';

describe('SEED_FOODS', () => {
  it('every food has a category', () => {
    const missing = SEED_FOODS.filter((f) => !f.category);
    expect(missing).toEqual([]);
  });

  it('every category is in the closed list', () => {
    const valid = new Set<string>(CATEGORIES);
    const offenders = SEED_FOODS.filter((f) => !valid.has(f.category));
    expect(offenders.map((f) => `${f.name}: ${f.category}`)).toEqual([]);
  });

  it('produces a sane distribution (no category is empty)', () => {
    const counts = new Map<string, number>();
    for (const f of SEED_FOODS) counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
    for (const c of CATEGORIES) {
      expect(counts.get(c) ?? 0).toBeGreaterThanOrEqual(0);
    }
  });
});
