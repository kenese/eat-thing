import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecipeCard } from './RecipesPage';

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

  it('calls onClear when × Clear is clicked', () => {
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
    fireEvent.click(screen.getByText('× Clear'));
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
