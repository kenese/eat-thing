import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  PlanPage,
  resolveAnchorAfterTodayChange,
  useCurrentLocalDay,
} from './PlanPage';
import type {
  InventoryRow,
  MealPlanEntriesResponse,
  Recipe,
  RecipeSummary,
  ShoppingListFromPlanPreview,
} from '@eat/shared';

type RecipeQueryResult = { data?: Recipe };
type PreviewQueryResult = {
  data: ShoppingListFromPlanPreview | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: ReturnType<typeof vi.fn>;
};

const mockUseQueries = vi.fn<() => RecipeQueryResult[]>(() => []);
const mockUseRecipes = vi.fn<() => { data: RecipeSummary[] }>(() => ({ data: [] }));
const mockUseInventory = vi.fn<() => { data: InventoryRow[] }>(() => ({ data: [] }));
const mockUseMealPlanEntries = vi.fn<
  (from: string, to: string) => { data: MealPlanEntriesResponse; isLoading: boolean; from?: string; to?: string }
>();
const mockUseAddMealPlanEntry = vi.fn(() => ({ mutate: vi.fn() }));
const mockUseUpdateMealPlanEntry = vi.fn(() => ({ mutate: vi.fn() }));
const mockUseDeleteMealPlanEntry = vi.fn(() => ({ mutate: vi.fn() }));
const mockUseShoppingListFromPlanPreview = vi.fn<(entryIds: string[], enabled: boolean) => PreviewQueryResult>(() => ({
  data: undefined,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
}));
const mockApplyMutateAsync = vi.fn();
const mockUseApplyPlanToShoppingList = vi.fn(() => ({
  mutateAsync: mockApplyMutateAsync,
  isPending: false,
}));
const mockNavigate = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueries: () => mockUseQueries(),
  };
});

vi.mock('../../hooks/useRecipes', () => ({
  useRecipes: () => mockUseRecipes(),
}));

vi.mock('../../hooks/useInventory', () => ({
  useInventory: () => mockUseInventory(),
}));

vi.mock('../../hooks/useMealPlan', () => ({
  useMealPlanEntries: (from: string, to: string) => mockUseMealPlanEntries(from, to),
  useAddMealPlanEntry: () => mockUseAddMealPlanEntry(),
  useUpdateMealPlanEntry: () => mockUseUpdateMealPlanEntry(),
  useDeleteMealPlanEntry: () => mockUseDeleteMealPlanEntry(),
}));

vi.mock('../../hooks/useShoppingList', () => ({
  useShoppingListFromPlanPreview: (entryIds: string[], enabled: boolean) => mockUseShoppingListFromPlanPreview(entryIds, enabled),
  useApplyPlanToShoppingList: () => mockUseApplyPlanToShoppingList(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('PlanPage time handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseMealPlanEntries.mockImplementation((from: string, to: string) => ({
      data: { entries: [] },
      isLoading: false,
      from,
      to,
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('useCurrentLocalDay refreshes after local midnight', () => {
    vi.setSystemTime(new Date('2026-06-03T23:59:30'));

    const { result } = renderHook(() => useCurrentLocalDay());

    expect(toIso(result.current)).toBe('2026-06-03');

    act(() => {
      vi.setSystemTime(new Date('2026-06-04T00:00:01'));
      vi.advanceTimersByTime(30_000);
    });

    expect(toIso(result.current)).toBe('2026-06-04');
  });

  it('resolveAnchorAfterTodayChange only advances anchors that were on today', () => {
    const previousToday = new Date(2026, 5, 3);
    const nextToday = new Date(2026, 5, 4);
    const distantAnchor = new Date(2026, 6, 15);

    expect(toIso(resolveAnchorAfterTodayChange(previousToday, previousToday, nextToday))).toBe('2026-06-04');
    expect(toIso(resolveAnchorAfterTodayChange(distantAnchor, previousToday, nextToday))).toBe('2026-07-15');
  });

  it('today resets a distant anchor back to the current day window', async () => {
    vi.setSystemTime(new Date('2026-06-03T10:00:00'));

    render(
      <MemoryRouter>
        <PlanPage />
      </MemoryRouter>,
    );

    expect(mockUseMealPlanEntries).toHaveBeenLastCalledWith('2026-06-01', '2026-06-17');

    fireEvent.click(screen.getByRole('button', { name: 'Load date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wednesday 15 July 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'choose wednesday 15 july 2026' }));

    expect(mockUseMealPlanEntries).toHaveBeenLastCalledWith('2026-07-13', '2026-07-29');

    fireEvent.click(screen.getByRole('button', { name: 'today' }));

    expect(mockUseMealPlanEntries).toHaveBeenLastCalledWith('2026-06-01', '2026-06-17');
  });

  it('opens the auto-shop preview and confirms through the shopping-list mutation', async () => {
    vi.setSystemTime(new Date('2026-06-03T10:00:00'));
    mockUseRecipes.mockReturnValue({
      data: [{
        id: 'recipe-1',
        name: 'Tomato Pasta',
        servings: 4,
        sourceUrl: null,
        sourceImage: null,
        ingredientCount: 1,
        totalTimeMinutes: 25,
        tags: [],
        canonicalFoodIds: ['food-tomato'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
    });
    mockUseMealPlanEntries.mockReturnValue({
      data: {
        entries: [{ id: 'entry-1', date: '2026-06-04', recipeId: 'recipe-1', recipeName: 'Tomato Pasta', servings: 4, status: 'planned' }],
      },
      isLoading: false,
    });
    mockUseQueries.mockReturnValue([{
      data: {
        id: 'recipe-1',
        householdId: 'hh-1',
        name: 'Tomato Pasta',
        servings: 4,
        sourceUrl: null,
        sourceImage: null,
        instructions: null,
        totalTimeMinutes: 25,
        tags: [],
        ingredients: [{ id: 'ing-1', recipeId: 'recipe-1', canonicalFoodId: 'food-tomato', foodName: 'Tomatoes', qty: '500', unit: 'g', section: null, metricValue: null, optional: false, sortOrder: 0 }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }]);
    mockUseShoppingListFromPlanPreview.mockReturnValue({
      data: {
        scheduledFor: '2026-06-05',
        entryIds: ['entry-1'],
        dayCount: 1,
        recipeCount: 1,
        itemCount: 1,
        recipeItemCount: 1,
        stapleItemCount: 0,
        items: [{
          canonicalFoodId: 'food-tomato',
          name: 'Tomatoes',
          qty: 500,
          unit: 'g',
          source: 'recipe',
          sourceRecipeNames: ['Tomato Pasta'],
          sourceRecipeId: 'recipe-1',
        }],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(
      <MemoryRouter>
        <PlanPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /add recipes to list/i }));
    expect(screen.getByText(/shopping for 2026-06-05/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update list/i }));
    });

    expect(mockApplyMutateAsync).toHaveBeenCalledWith({ entryIds: ['entry-1'] });
    expect(mockNavigate).toHaveBeenCalledWith('/list');
  });
});
