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

describe('useAddMealPlanEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT auto-regenerate the shopping list when a recipe is added', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      id: 'entry-1',
      date: '2026-05-14',
      recipeId: '00000000-0000-0000-0000-000000000001',
      recipeName: 'Pasta',
      servings: 2,
      status: 'planned',
    });

    const { result } = renderHook(() => useAddMealPlanEntry(), { wrapper });

    result.current.mutate({
      date: '2026-05-14',
      recipeId: '00000000-0000-0000-0000-000000000001',
      servings: 2,
    });

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      date: '2026-05-14',
      recipeId: '00000000-0000-0000-0000-000000000001',
      servings: 2,
    });
    expect(api.post).not.toHaveBeenCalledWith('/api/shopping-lists/generate', expect.anything());
    expect(api.post).not.toHaveBeenCalledWith('/api/shopping-lists/from-plan', expect.anything());
  });
});

describe('useAddToNextEmptyDays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('places recipes into the next N empty days starting from today, without touching shopping list', async () => {
    // Single date-range query covers the 28-day candidate window.
    vi.mocked(api.get).mockResolvedValueOnce({
      entries: [
        { id: 'e1', date: '2026-05-11', recipeId: 'rx', recipeName: 'X', servings: 2, status: 'planned' },
        { id: 'e2', date: '2026-05-12', recipeId: 'ry', recipeName: 'Y', servings: 2, status: 'planned' },
        { id: 'e3', date: '2026-05-18', recipeId: 'rz', recipeName: 'Z', servings: 2, status: 'planned' },
      ],
    });

    vi.mocked(api.post).mockResolvedValue({});

    const { result } = renderHook(() => useAddToNextEmptyDays(), { wrapper });

    const out = await result.current.mutateAsync([
      { recipeId: 'recipe-1', servings: 2 },
      { recipeId: 'recipe-2', servings: 4 },
    ]);

    expect(api.get).toHaveBeenCalledTimes(1);

    // First two empty days from today: May 13 and May 14.
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      date: '2026-05-13',
      recipeId: 'recipe-1',
      servings: 2,
    });
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      date: '2026-05-14',
      recipeId: 'recipe-2',
      servings: 4,
    });

    expect(api.post).not.toHaveBeenCalledWith('/api/shopping-lists/generate', expect.anything());
    expect(api.post).not.toHaveBeenCalledWith('/api/shopping-lists/from-plan', expect.anything());

    expect(out.skipped).toHaveLength(0);
    expect(out.addedTo).toHaveLength(2);
  });

  it('returns skipped recipes when fewer empty days than items', async () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const entries = Array.from({ length: 28 }, (_, i) => {
      const d = new Date(2026, 4, 11 + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { id: iso, date: iso, recipeId: 'r0', recipeName: 'Q', servings: 2, status: 'planned' as const };
    });
    vi.mocked(api.get).mockResolvedValueOnce({ entries });

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
