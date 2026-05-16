import { describe, it, expect } from 'vitest';
import { mondayOf, addDays, toIsoDate, weekDays, formatWeekRange, planWindow, planWindowDays, TODAY_INDEX, WINDOW_SIZE } from './dateUtils';

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

describe('plan window', () => {
  it('TODAY_INDEX is 2 (third visible column)', () => {
    expect(TODAY_INDEX).toBe(2);
  });

  it('WINDOW_SIZE is 17 (today minus 2 through today plus 14)', () => {
    expect(WINDOW_SIZE).toBe(17);
  });

  it('planWindow returns from/to ISO dates centred on today', () => {
    const today = new Date('2026-05-16T10:00:00');
    const { from, to } = planWindow(today);
    expect(from).toBe('2026-05-14');
    expect(to).toBe('2026-05-30');
  });

  it('planWindowDays returns 17 day objects with today at index 2', () => {
    const today = new Date('2026-05-16T10:00:00');
    const days = planWindowDays(today);
    expect(days).toHaveLength(17);
    expect(days[0].iso).toBe('2026-05-14');
    expect(days[2].iso).toBe('2026-05-16');
    expect(days[2].isToday).toBe(true);
    expect(days[16].iso).toBe('2026-05-30');
    expect(days[0].isToday).toBe(false);
  });

  it('planWindowDays labels use short weekday + day of month', () => {
    const today = new Date('2026-05-16T10:00:00');
    const days = planWindowDays(today);
    expect(days[2].label).toMatch(/^Sat 16$/);
  });
});
