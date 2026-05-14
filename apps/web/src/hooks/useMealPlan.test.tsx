import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAddMealPlanEntry } from './useMealPlan';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    post: vi.fn(),
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
