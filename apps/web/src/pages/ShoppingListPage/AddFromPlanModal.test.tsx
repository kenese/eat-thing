import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AddFromPlanModal } from './AddFromPlanModal';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('AddFromPlanModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-05-16T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an empty state when no upcoming entries', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ entries: [] });

    render(<AddFromPlanModal currentListRecipeIds={new Set()} onClose={() => {}} />, { wrapper });

    await waitFor(() => expect(screen.getByText(/no planned recipes/i)).toBeInTheDocument());
  });

  it('shows upcoming days with pre-tick reflecting current list recipes', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      entries: [
        { id: 'e1', date: '2026-05-17', recipeId: 'r-pasta', recipeName: 'Pasta', servings: 2, status: 'planned' },
        { id: 'e2', date: '2026-05-18', recipeId: 'r-curry', recipeName: 'Curry', servings: 4, status: 'planned' },
      ],
    });

    render(
      <AddFromPlanModal
        currentListRecipeIds={new Set(['r-pasta'])}
        onClose={() => {}}
      />,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByLabelText(/Pasta/)).toBeChecked());
    expect(screen.getByLabelText(/Curry/)).not.toBeChecked();
  });

  it('calls /from-plan with ticked entry ids on submit', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      entries: [
        { id: 'e1', date: '2026-05-17', recipeId: 'r-pasta', recipeName: 'Pasta', servings: 2, status: 'planned' },
        { id: 'e2', date: '2026-05-18', recipeId: 'r-curry', recipeName: 'Curry', servings: 4, status: 'planned' },
      ],
    });
    vi.mocked(api.post).mockResolvedValue({ id: 'list-1', items: [] });

    const onClose = vi.fn();
    render(
      <AddFromPlanModal
        currentListRecipeIds={new Set(['r-pasta'])}
        onClose={onClose}
      />,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByLabelText(/Pasta/)).toBeChecked());

    // Tick Curry; pasta stays ticked
    fireEvent.click(screen.getByLabelText(/Curry/));

    fireEvent.click(screen.getByRole('button', { name: /Update list/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/shopping-lists/from-plan', { entryIds: ['e1', 'e2'] }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
