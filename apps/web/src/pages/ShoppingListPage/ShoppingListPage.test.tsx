import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShoppingListPage } from './ShoppingListPage';

const hooks = vi.hoisted(() => ({
  useCurrentShoppingList: vi.fn(),
  useGenerateShoppingList: vi.fn(),
  useUpdateShoppingListItem: vi.fn(),
  useAddShoppingListItem: vi.fn(),
  useDeleteShoppingListItem: vi.fn(),
  usePricesForList: vi.fn(),
  useRefreshPrices: vi.fn(),
}));

vi.mock('../../hooks/useShoppingList', () => ({
  useCurrentShoppingList: hooks.useCurrentShoppingList,
  useGenerateShoppingList: hooks.useGenerateShoppingList,
  useUpdateShoppingListItem: hooks.useUpdateShoppingListItem,
  useAddShoppingListItem: hooks.useAddShoppingListItem,
  useDeleteShoppingListItem: hooks.useDeleteShoppingListItem,
}));
vi.mock('../../hooks/usePricesForList', () => ({
  usePricesForList: hooks.usePricesForList,
  useRefreshPrices: hooks.useRefreshPrices,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ShoppingListPage /></QueryClientProvider>);
}

const baseList = {
  id: 'list-1', householdId: 'h', generatedFromMealPlanId: null,
  createdAt: '2026-05-10T00:00:00Z', finalizedAt: null,
  items: [
    { id: 'i1', shoppingListId: 'list-1', canonicalFoodId: 'cf1', name: 'Eggs',  qty: 1, unit: 'count', source: 'recipe', checked: false, category: 'dairy' },
    { id: 'i2', shoppingListId: 'list-1', canonicalFoodId: 'cf2', name: 'Bread', qty: 1, unit: 'count', source: 'staple', checked: false, category: 'pantry' },
  ],
};

describe('ShoppingListPage prices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.useCurrentShoppingList.mockReturnValue({ data: baseList, isLoading: false });
    hooks.useGenerateShoppingList.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.useUpdateShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.useAddShoppingListItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useDeleteShoppingListItem.mockReturnValue({ mutate: vi.fn() });
  });

  it('renders the new page title', () => {
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    expect(screen.getByText('The list')).toBeInTheDocument();
  });

  it('renders category section headings', () => {
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    // Eggs → dairy category → "Dairy & eggs" heading
    expect(screen.getByText('Dairy & eggs')).toBeInTheDocument();
    // Bread → pantry category → "Pantry & dry goods" heading
    expect(screen.getByText('Pantry & dry goods')).toBeInTheDocument();
  });

  it('renders matched price', () => {
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [{ id: 'p1', shoppingListItemId: 'i1', store: 'new_world', sku: 'NW-001', name: 'Free Range Eggs', price: 7.49, inStock: true, matched: true, checkedAt: '2026-05-10T01:00:00Z' }],
        job: { id: 'j1', status: 'done', error: null },
      },
    });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    // The price appears in the row cell, section subtotal, and sidebar totals
    const priceEls = screen.getAllByText('$7.49');
    expect(priceEls.length).toBeGreaterThanOrEqual(1);
    // Confirm the per-item price cell is present
    expect(priceEls.some((el) => el.classList.contains('sl-row-price'))).toBe(true);
  });

  it('renders out-of-stock', () => {
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [{ id: 'p2', shoppingListItemId: 'i1', store: 'new_world', sku: 'NW-001', name: 'Eggs', price: 7.49, inStock: false, matched: true, checkedAt: '2026-05-10T01:00:00Z' }],
        job: null,
      },
    });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    expect(screen.getByText('out of stock')).toBeInTheDocument();
  });

  it('renders no-match', () => {
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [{ id: 'p3', shoppingListItemId: 'i1', store: 'new_world', sku: null, name: null, price: null, inStock: false, matched: false, checkedAt: '2026-05-10T01:00:00Z' }],
        job: null,
      },
    });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    expect(screen.getByText('no match')).toBeInTheDocument();
  });

  it('shows loading state for items without prices when refreshing', () => {
    hooks.usePricesForList.mockReturnValue({
      data: { prices: [], job: { id: 'j1', status: 'in_progress', error: null } },
    });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    // Sidebar refresh button shows "Checking prices…" when job is in_progress
    expect(screen.getByText('Checking prices…')).toBeInTheDocument();
  });

  it('refresh button enqueues a job', async () => {
    const refreshMutate = vi.fn();
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: refreshMutate, isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /refresh prices/i }));
    await waitFor(() => expect(refreshMutate).toHaveBeenCalled());
  });

  it('send to store button is disabled', () => {
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    const sendBtn = screen.getByRole('button', { name: /send to/i });
    expect(sendBtn).toBeDisabled();
  });
});
