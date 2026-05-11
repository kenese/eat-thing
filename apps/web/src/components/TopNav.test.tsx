import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopNav } from './TopNav';

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <TopNav />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TopNav', () => {
  it('renders the wordmark', () => {
    renderAt('/');
    expect(screen.getByLabelText('Eat thing')).toBeInTheDocument();
  });

  it('renders the five lowercase nav items in order', () => {
    renderAt('/');
    const labels = screen.getAllByRole('link').map((l) => l.textContent?.trim());
    expect(labels).toEqual(['home', 'inventory', 'recipes', 'plan', 'list']);
  });

  it('does not include a shops link', () => {
    renderAt('/');
    expect(screen.queryByRole('link', { name: 'shops' })).not.toBeInTheDocument();
  });

  it('marks the active route', () => {
    renderAt('/recipes');
    const active = screen.getByRole('link', { name: 'recipes' });
    expect(active.className).toContain('topnav-link--active');
  });
});
