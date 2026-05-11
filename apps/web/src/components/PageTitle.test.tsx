import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageTitle } from './PageTitle';

describe('PageTitle', () => {
  it('renders eyebrow, title with persimmon period, and summary', () => {
    render(
      <PageTitle
        eyebrow="The kitchen · 9:14 am"
        title="Inventory"
        summary={<span>127 items on hand</span>}
      />,
    );
    expect(screen.getByText('The kitchen · 9:14 am')).toBeInTheDocument();
    // Title text and the persimmon period are split into two nodes.
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('.')).toHaveClass('dot');
    expect(screen.getByText('127 items on hand')).toBeInTheDocument();
  });

  it('renders actions on the right when provided', () => {
    render(
      <PageTitle
        title="Recipes"
        actions={<button>+ new recipe</button>}
      />,
    );
    expect(screen.getByRole('button', { name: '+ new recipe' })).toBeInTheDocument();
  });

  it('omits the eyebrow when not provided', () => {
    const { container } = render(<PageTitle title="The list" />);
    expect(container.querySelector('.page-title-eyebrow')).toBeNull();
  });
});
