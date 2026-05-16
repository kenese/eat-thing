import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';

function renderBar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar />
    </MemoryRouter>,
  );
}

describe('BottomTabBar', () => {
  it('renders all five tab labels', () => {
    renderBar();
    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.getByText('pantry')).toBeInTheDocument();
    expect(screen.getByText('recipes')).toBeInTheDocument();
    expect(screen.getByText('plan')).toBeInTheDocument();
    expect(screen.getByText('list')).toBeInTheDocument();
  });

  it('marks the active tab with the active class', () => {
    renderBar('/recipes');
    const recipesLink = screen.getByRole('link', { name: /recipes/i });
    expect(recipesLink.className).toContain('tab--active');
  });

  it('maps /inventory to the pantry tab', () => {
    renderBar('/inventory');
    const pantryLink = screen.getByRole('link', { name: /pantry/i });
    expect(pantryLink.className).toContain('tab--active');
  });
});
