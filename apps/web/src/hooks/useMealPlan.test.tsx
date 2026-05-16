import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAddMealPlanEntry, useAddToNextEmptyDays } from './useMealPlan';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useMealPlan mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('regenerates the shopping list when a recipe is added to the meal plan', async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        mealPlanId: 'plan-1',
        entry: {
          id: 'entry-1',
          mealPlanId: 'plan-1',
          date: '2026-05-14',
          recipeId: '00000000-0000-0000-0000-000000000001',
          recipeName: 'Pasta',
          servings: 2,
          status: 'planned',
        },
      })
      .mockResolvedValueOnce({ id: 'list-1', items: [] });

    const { result } = renderHook(() => useAddMealPlanEntry(), { wrapper });

    result.current.mutate({
      weekStart: '2026-05-11',
      date: '2026-05-14',
      recipeId: '00000000-0000-0000-0000-000000000001',
      servings: 2,
    });

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post).toHaveBeenNthCalledWith(2, '/api/shopping-lists/generate', { weekStart: '2026-05-11' });
  });
});

describe('useAddToNextEmptyDays', () => {
  // Monday 2026-05-11: 28 candidates span exactly 4 complete weeks (May 11–Jun 7) → 4 api.get calls
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('places recipes into the next N empty days starting from today', async () => {
    // Week 1 (May 11): today and tomorrow occupied, rest of week empty
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        weekStart: '2026-05-11', mealPlanId: 'p1',
        entries: [
          { id: 'e1', mealPlanId: 'p1', date: '2026-05-11', recipeId: 'rx', recipeName: 'X', servings: 2, status: 'planned' },
          { id: 'e2', mealPlanId: 'p1', date: '2026-05-12', recipeId: 'ry', recipeName: 'Y', servings: 2, status: 'planned' },
        ],
      })
      .mockResolvedValueOnce({
        weekStart: '2026-05-18', mealPlanId: 'p2',
        entries: [
          { id: 'e3', mealPlanId: 'p2', date: '2026-05-18', recipeId: 'rz', recipeName: 'Z', servings: 2, status: 'planned' },
        ],
      })
      .mockResolvedValueOnce({ weekStart: '2026-05-25', mealPlanId: null, entries: [] })
      .mockResolvedValueOnce({ weekStart: '2026-06-01', mealPlanId: null, entries: [] });

    vi.mocked(api.post).mockResolvedValue({});

    const { result } = renderHook(() => useAddToNextEmptyDays(), { wrapper });

    const out = await result.current.mutateAsync([
      { recipeId: 'recipe-1', servings: 2 },
      { recipeId: 'recipe-2', servings: 4 },
    ]);

    expect(api.get).toHaveBeenCalledTimes(4);

    // First two empty days from today: May 13 and May 14 (both in week of May 11)
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      weekStart: '2026-05-11',
      date: '2026-05-13',
      recipeId: 'recipe-1',
      servings: 2,
    });
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      weekStart: '2026-05-11',
      date: '2026-05-14',
      recipeId: 'recipe-2',
      servings: 4,
    });

    expect(api.post).toHaveBeenCalledWith('/api/shopping-lists/generate', { weekStart: '2026-05-11' });

    expect(out.skipped).toHaveLength(0);
    expect(out.addedTo).toHaveLength(2);
  });

  it('returns skipped recipes when fewer empty days than items', async () => {
    // Use local Date constructor to match the hook's local-time date strings
    const pad = (n: number) => String(n).padStart(2, '0');
    const makeFullWeek = (weekStart: string) => {
      const [yr, mo, dy] = weekStart.split('-').map(Number);
      return {
        weekStart, mealPlanId: 'px',
        entries: Array.from({ length: 7 }, (_, i) => {
          const d = new Date(yr, mo - 1, dy + i);
          const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          return { id: iso, mealPlanId: 'px', date: iso, recipeId: 'r0', recipeName: 'Q', servings: 2, status: 'planned' as const };
        }),
      };
    };

    vi.mocked(api.get)
      .mockResolvedValueOnce(makeFullWeek('2026-05-11'))
      .mockResolvedValueOnce(makeFullWeek('2026-05-18'))
      .mockResolvedValueOnce(makeFullWeek('2026-05-25'))
      .mockResolvedValueOnce(makeFullWeek('2026-06-01'));

    vi.mocked(api.post).mockResolvedValue({});

    const { result } = renderHook(() => useAddToNextEmptyDays(), { wrapper });

    const out = await result.current.mutateAsync([
      { recipeId: 'recipe-1', servings: 2 },
      { recipeId: 'recipe-2', servings: 4 },
    ]);

    expect(api.post).not.toHaveBeenCalledWith('/api/meal-plans/entries', expect.anything());
    expect(out.addedTo).toHaveLength(0);
    expect(out.skipped).toEqual(['recipe-1', 'recipe-2']);
  });
});
