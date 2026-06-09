import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeekCarousel } from './WeekCarousel';
import { planWindowDays } from '../lib/dateUtils';

describe('WeekCarousel', () => {
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    vi.restoreAllMocks();
  });

  it('scrolls the requested initial day into view', () => {
    const today = new Date(2026, 5, 3);
    const todayIso = '2026-06-03';
    const days = planWindowDays(today, today);

    Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
      if (this.classList.contains('plan-week-scroll')) {
        return { left: 10, right: 410, top: 0, bottom: 100, width: 400, height: 100, x: 10, y: 0, toJSON: () => ({}) } as DOMRect;
      }

      if (this.classList.contains('day-col') && this.getAttribute('data-iso') === todayIso) {
        return { left: 210, right: 330, top: 0, bottom: 100, width: 120, height: 100, x: 210, y: 0, toJSON: () => ({}) } as DOMRect;
      }

      return { left: 10, right: 130, top: 0, bottom: 100, width: 120, height: 100, x: 10, y: 0, toJSON: () => ({}) } as DOMRect;
    });

    const { container } = render(
      <WeekCarousel
        days={days}
        entriesByDay={{}}
        loading={false}
        initialScrollIso={todayIso}
      />,
    );

    expect(container.querySelector<HTMLDivElement>('.plan-week-scroll')?.scrollLeft).toBe(200);
  });
});
