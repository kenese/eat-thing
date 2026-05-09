import { describe, it, expect } from 'vitest';
import { mondayOf, addDays, toIsoDate, weekDays, formatWeekRange } from './dateUtils';

describe('mondayOf', () => {
  it('returns the same day when given a Monday', () => {
    const mon = new Date(2026, 4, 4); // Mon 2026-05-04
    expect(toIsoDate(mondayOf(mon))).toBe('2026-05-04');
  });

  it('rewinds to Monday when given a Wednesday', () => {
    const wed = new Date(2026, 4, 6);
    expect(toIsoDate(mondayOf(wed))).toBe('2026-05-04');
  });

  it('rewinds to the previous Monday when given a Sunday', () => {
    const sun = new Date(2026, 4, 10);
    expect(toIsoDate(mondayOf(sun))).toBe('2026-05-04');
  });
});

describe('addDays', () => {
  it('moves forward and backward', () => {
    const d = new Date(2026, 4, 4);
    expect(toIsoDate(addDays(d, 6))).toBe('2026-05-10');
    expect(toIsoDate(addDays(d, -1))).toBe('2026-05-03');
  });
});

describe('weekDays', () => {
  it('returns 7 entries Mon→Sun starting at the given Monday', () => {
    const days = weekDays(new Date(2026, 4, 4));
    expect(days).toHaveLength(7);
    expect(days[0]?.iso).toBe('2026-05-04');
    expect(days[0]?.label).toMatch(/^Mon /);
    expect(days[6]?.iso).toBe('2026-05-10');
    expect(days[6]?.label).toMatch(/^Sun /);
  });
});

describe('formatWeekRange', () => {
  it('uses a single month label when the week stays in one month', () => {
    expect(formatWeekRange(new Date(2026, 4, 4))).toMatch(/^4–10 May 2026$/);
  });

  it('spans two months when the week crosses one', () => {
    expect(formatWeekRange(new Date(2026, 3, 27))).toMatch(/^27 Apr – 3 May 2026$/);
  });
});
