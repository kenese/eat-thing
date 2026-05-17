import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RecipeForm } from './RecipeForm';
import { useAddRecipe } from '../../hooks/useRecipes';

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

describe('RecipeForm ingredient line identity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders duplicate canonical and unresolved imported ingredients without key warnings', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <RecipeForm
        mode="add"
        onClose={vi.fn()}
        initialData={{
          name: 'Lemon pasta',
          servings: 2,
          sourceUrl: null,
          sourceImage: null,
          heroImageUrl: null,
          instructions: null,
          ingredients: [
            { rawText: '1 lemon', canonicalFoodId: 'f-lemon', foodName: 'Lemon', canonicalDefaultUnit: 'count', qty: '1', unit: '', section: 'Pasta', metric: '1 count', optional: false, confidence: 'high' },
            { rawText: '1 lemon', canonicalFoodId: 'f-lemon', foodName: 'Lemon', canonicalDefaultUnit: 'count', qty: '1', unit: '', section: 'Sauce', metric: '1 count', optional: false, confidence: 'high' },
            { rawText: 'pinch flaky salt', canonicalFoodId: null, foodName: null, canonicalDefaultUnit: null, qty: '1', unit: 'pinch', section: 'Finish', metric: null, optional: false, confidence: 'low' },
            { rawText: 'pinch flaky salt', canonicalFoodId: null, foodName: null, canonicalDefaultUnit: null, qty: '1', unit: 'pinch', section: 'Finish', metric: null, optional: false, confidence: 'low' },
          ],
        }}
      />,
      { wrapper },
    );

    expect(screen.getAllByText('Lemon')).toHaveLength(2);
    expect(screen.getAllByText('Original: pinch flaky salt')).toHaveLength(2);
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Encountered two children with the same key'), expect.anything());
    errorSpy.mockRestore();
  });

  it('submits duplicate ingredients as separate sectioned line items', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(useAddRecipe).mockReturnValue({mutateAsync, isPending: false} as unknown as ReturnType<typeof useAddRecipe>);

    render(
      <RecipeForm
        mode="add"
        onClose={vi.fn()}
        initialData={{
          name: 'Lemon pasta',
          servings: 2,
          sourceUrl: null,
          sourceImage: null,
          heroImageUrl: null,
          instructions: null,
          ingredients: [
            { rawText: '1 lemon', canonicalFoodId: 'f-lemon', foodName: 'Lemon', canonicalDefaultUnit: 'count', qty: '1', unit: 'count', section: 'Pasta', metric: '1 count', optional: false, confidence: 'high' },
            { rawText: '1 lemon', canonicalFoodId: 'f-lemon', foodName: 'Lemon', canonicalDefaultUnit: 'count', qty: '1', unit: 'count', section: 'Sauce', metric: '1 count', optional: false, confidence: 'high' },
          ],
        }}
      />,
      { wrapper },
    );

    fireEvent.click(screen.getByRole('button', { name: /save imported recipe/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      ingredients: [
        expect.objectContaining({ canonicalFoodId: 'f-lemon', section: 'Pasta' }),
        expect.objectContaining({ canonicalFoodId: 'f-lemon', section: 'Sauce' }),
      ],
    }));
  });
});
