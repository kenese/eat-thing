import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RecipeForm } from './RecipeForm';

vi.mock('../../hooks/useRecipes', () => ({
  useRecipe: vi.fn(() => ({
    data: {
      id: 'r1',
      name: 'Pasta',
      servings: 4,
      sourceUrl: null,
      sourceImage: null,
      instructions: null,
      ingredients: [
        { id: 'i1', canonicalFoodId: 'f1', foodName: 'Flour', qty: '200', unit: 'g', optional: false, sortOrder: 0 },
      ],
    },
    isLoading: false,
  })),
  useAddRecipe: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateRecipe: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('../../hooks/useFoodSearch', () => ({
  useFoodSearch: vi.fn(() => ({ data: [] })),
  useCreateFood: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@eat/taxonomy', () => ({
  toCanonical: vi.fn((qty: number, unit: string) => ({ qty, unit })),
  isMassUnit: vi.fn(() => false),
  isVolumeUnit: vi.fn(() => false),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('RecipeForm read-only view — Add to plan button', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders "Add to plan" button when onAddToPlan prop is provided', () => {
    render(
      <RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} onAddToPlan={vi.fn().mockResolvedValue({ addedTo: ['Mon 19 May'], skipped: [] })} />,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: /add to plan/i })).toBeInTheDocument();
  });

  it('does not render "Add to plan" button when onAddToPlan is not provided', () => {
    render(<RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} />, { wrapper });
    expect(screen.queryByRole('button', { name: /add to plan/i })).not.toBeInTheDocument();
  });

  it('calls onAddToPlan with recipeId and servings, then shows success label', async () => {
    const onAddToPlan = vi.fn().mockResolvedValue({ addedTo: ['Mon 19 May'], skipped: [] });
    render(
      <RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} onAddToPlan={onAddToPlan} />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /add to plan/i }));
    await waitFor(() => expect(onAddToPlan).toHaveBeenCalledWith('r1', 4));
    await waitFor(() => expect(screen.getByRole('button', { name: /mon 19 may/i })).toBeInTheDocument());
  });
});
