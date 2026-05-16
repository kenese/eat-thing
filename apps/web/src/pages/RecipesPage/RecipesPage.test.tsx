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

export { waitFor }; // re-export for SelectionBar tests added in Task 3
