import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { RecipeCard } from './RecipesPage';
import { HeroPlanButton } from './RecipesPage';
import { RecipesPage } from './RecipesPage';

const pageHooks = vi.hoisted(() => ({
  useRecipes: vi.fn(),
  useRecipe: vi.fn(),
  useDeleteRecipe: vi.fn(),
  useInventory: vi.fn(),
  useCurrentShoppingList: vi.fn(),
  useAddToNextEmptyDays: vi.fn(),
}));

vi.mock('../../hooks/useRecipes', () => ({
  useRecipes: pageHooks.useRecipes,
  useRecipe: pageHooks.useRecipe,
  useDeleteRecipe: pageHooks.useDeleteRecipe,
}));
vi.mock('../../hooks/useInventory', () => ({
  useInventory: pageHooks.useInventory,
}));
vi.mock('../../hooks/useShoppingList', () => ({
  useCurrentShoppingList: pageHooks.useCurrentShoppingList,
}));
vi.mock('../../hooks/useMealPlan', () => ({
  useAddToNextEmptyDays: pageHooks.useAddToNextEmptyDays,
}));

const recipe = {
  id: 'r1',
  name: 'Pasta Carbonara',
  servings: 4,
  sourceUrl: null,
  sourceImage: null,
  ingredientCount: 5,
  totalTimeMinutes: 20,
  tags: ['pasta', 'quick'],
  canonicalFoodIds: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const match = { bucket: 'library' as const, missing: [] };

describe('RecipeCard selection', () => {
  it('calls onOpen when card body is clicked', () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    render(<RecipeCard recipe={recipe} match={match} onOpen={onOpen} onSelect={onSelect} selected={false} />);
    fireEvent.click(screen.getByRole('button', { name: /pasta carbonara/i }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect (not onOpen) when checkbox is clicked', () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    render(<RecipeCard recipe={recipe} match={match} onOpen={onOpen} onSelect={onSelect} selected={false} />);
    fireEvent.click(screen.getByRole('button', { name: /select recipe/i }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows deselect label when selected=true', () => {
    render(<RecipeCard recipe={recipe} match={match} onOpen={vi.fn()} onSelect={vi.fn()} selected={true} />);
    expect(screen.getByRole('button', { name: /deselect recipe/i })).toBeInTheDocument();
  });

  it('renders no checkbox when onSelect is undefined', () => {
    render(<RecipeCard recipe={recipe} match={match} onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /select recipe/i })).not.toBeInTheDocument();
  });
});

import { SelectionBar } from './RecipesPage';

const selectionRecipes = [
  { id: 'r1', name: 'Pasta', servings: 4, sourceUrl: null, sourceImage: null, ingredientCount: 5, totalTimeMinutes: null, tags: [], canonicalFoodIds: [], createdAt: '', updatedAt: '' },
  { id: 'r2', name: 'Pizza', servings: 2, sourceUrl: null, sourceImage: null, ingredientCount: 3, totalTimeMinutes: null, tags: [], canonicalFoodIds: [], createdAt: '', updatedAt: '' },
];

describe('SelectionBar', () => {
  it('is not visible when nothing is selected', () => {
    render(
      <SelectionBar
        selectedIds={new Set()}
        recipes={selectionRecipes}
        onClear={vi.fn()}
        onAddToPlan={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const bar = document.querySelector('.rx-selection-bar');
    expect(bar).not.toHaveClass('rx-selection-bar--visible');
  });

  it('shows count when recipes are selected', () => {
    render(
      <SelectionBar
        selectedIds={new Set(['r1', 'r2'])}
        recipes={selectionRecipes}
        onClear={vi.fn()}
        onAddToPlan={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('calls onClear when × clear is clicked', () => {
    const onClear = vi.fn();
    render(
      <SelectionBar
        selectedIds={new Set(['r1'])}
        recipes={selectionRecipes}
        onClear={onClear}
        onAddToPlan={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('× clear'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows inline confirmation when Delete is clicked', () => {
    render(
      <SelectionBar
        selectedIds={new Set(['r1'])}
        recipes={selectionRecipes}
        onClear={vi.fn()}
        onAddToPlan={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(screen.getByText(/can't be undone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onDelete and then onClear when Confirm delete is clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onClear = vi.fn();
    render(
      <SelectionBar
        selectedIds={new Set(['r1'])}
        recipes={selectionRecipes}
        onClear={onClear}
        onAddToPlan={vi.fn()}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    await waitFor(() => expect(onClear).toHaveBeenCalledOnce());
  });
});

describe('Library bucket removal', () => {
  it('does not render a Library tab', () => {
    const libraryMatch = { bucket: 'library' as const, missing: ['a', 'b', 'c', 'd', 'e'] };
    render(<RecipeCard recipe={recipe} match={libraryMatch} onOpen={vi.fn()} />);
    // Library-bucketed recipe shows the shop chip (missingCount > 0), not a separate label
    expect(screen.queryByText(/library/i)).not.toBeInTheDocument();
  });
});

describe('HeroPlanButton', () => {
  it('shows the default label before adding', () => {
    render(
      <HeroPlanButton onAdd={vi.fn().mockResolvedValue({ addedTo: [], skipped: [] })} />,
    );

    expect(screen.getByRole('button', { name: 'add to next open day' })).toBeInTheDocument();
  });

  it('shows pending and success states around an add', async () => {
    let resolveAdd: ((value: { addedTo: string[]; skipped: string[] }) => void) | undefined;
    const onAdd = vi.fn(
      () =>
        new Promise<{ addedTo: string[]; skipped: string[] }>((resolve) => {
          resolveAdd = resolve;
        }),
    );

    render(<HeroPlanButton onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: 'add to next open day' }));

    expect(screen.getByRole('button', { name: 'adding...' })).toBeDisabled();

    resolveAdd?.({ addedTo: ['Wed, 3 Jun'], skipped: [] });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'added to Wed, 3 Jun' })).toBeInTheDocument(),
    );
  });

  it('shows retry state after failure and retries on click', async () => {
    const onAdd = vi
      .fn<() => Promise<{ addedTo: string[]; skipped: string[] }>>()
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce({ addedTo: ['Thu, 4 Jun'], skipped: [] });

    render(<HeroPlanButton onAdd={onAdd} />);

    fireEvent.click(screen.getByRole('button', { name: 'add to next open day' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'retry add to plan' })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'retry add to plan' }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'added to Thu, 4 Jun' })).toBeInTheDocument(),
    );
  });
});

function renderRecipesPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><RecipesPage /></QueryClientProvider>);
}

const shoppableRecipe = {
  id: 'r-shop',
  name: 'Fish tacos',
  servings: 4,
  sourceUrl: null,
  sourceImage: null,
  ingredientCount: 2,
  totalTimeMinutes: null,
  tags: [],
  canonicalFoodIds: ['food-fish'],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

function setupRecipesPage(scheduledFor: string | null) {
  pageHooks.useRecipes.mockReturnValue({ data: [shoppableRecipe], isLoading: false, isError: false });
  pageHooks.useRecipe.mockReturnValue({ data: null });
  pageHooks.useDeleteRecipe.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  pageHooks.useInventory.mockReturnValue({ data: [], isLoading: false });
  pageHooks.useCurrentShoppingList.mockReturnValue({
    data: {
      id: 'list-1',
      householdId: 'h',
      createdAt: '2026-06-01T00:00:00Z',
      finalizedAt: null,
      scheduledFor,
      items: [],
    },
    isLoading: false,
  });
  pageHooks.useAddToNextEmptyDays.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
}

describe('RecipesPage quick-shop copy', () => {
  it('uses the scheduled shopping date in quick-shop copy', () => {
    setupRecipesPage('2026-06-05');

    renderRecipesPage();

    expect(screen.getByText(/1 quick shop for fri 5 jun/i)).toBeInTheDocument();
    expect(screen.getByText(/add to your fri 5 jun list/i)).toBeInTheDocument();
  });

  it('keeps generic quick-shop copy without a scheduled shopping date', () => {
    setupRecipesPage(null);

    renderRecipesPage();

    expect(screen.getByText(/1 a quick shop away/i)).toBeInTheDocument();
    expect(screen.getByText(/auto-added to your next list/i)).toBeInTheDocument();
  });
});
