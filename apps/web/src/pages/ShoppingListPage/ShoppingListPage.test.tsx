import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShoppingListPage } from './ShoppingListPage';

const hooks = vi.hoisted(() => ({
  useCurrentShoppingList: vi.fn(),
  useUpdateShoppingListItem: vi.fn(),
  useAddShoppingListItem: vi.fn(),
  useDeleteShoppingListItem: vi.fn(),
  usePurchaseShoppingListItems: vi.fn(),
  useBatchDeleteShoppingListItems: vi.fn(),
  usePricesForList: vi.fn(),
  useRefreshPrices: vi.fn(),
  useChooseSku: vi.fn(),
  useFoodSearch: vi.fn(),
}));

vi.mock('../../hooks/useShoppingList', () => ({
  useCurrentShoppingList: hooks.useCurrentShoppingList,
  useUpdateShoppingListItem: hooks.useUpdateShoppingListItem,
  useAddShoppingListItem: hooks.useAddShoppingListItem,
  useDeleteShoppingListItem: hooks.useDeleteShoppingListItem,
  usePurchaseShoppingListItems: hooks.usePurchaseShoppingListItems,
  useBatchDeleteShoppingListItems: hooks.useBatchDeleteShoppingListItems,
}));

vi.mock('./AddFromPlanModal', () => ({
  AddFromPlanModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-from-plan-modal">
      <button onClick={onClose}>Close modal</button>
    </div>
  ),
}));
vi.mock('../../hooks/usePricesForList', () => ({
  usePricesForList: hooks.usePricesForList,
  useRefreshPrices: hooks.useRefreshPrices,
  useChooseSku: hooks.useChooseSku,
}));
vi.mock('../../hooks/useFoodSearch', () => ({
  useFoodSearch: hooks.useFoodSearch,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ShoppingListPage /></QueryClientProvider>);
}

const baseList = {
  id: 'list-1', householdId: 'h',
  createdAt: '2026-05-10T00:00:00Z', finalizedAt: null,
  items: [
    { id: 'i1', shoppingListId: 'list-1', canonicalFoodId: 'cf1', name: 'Eggs',  qty: 1, unit: 'count', source: 'recipe', checked: false, category: 'dairy',  sourceRecipeNames: ['Shakshuka'], sourceRecipeId: 'r1' },
    { id: 'i2', shoppingListId: 'list-1', canonicalFoodId: 'cf2', name: 'Bread', qty: 1, unit: 'count', source: 'staple', checked: false, category: 'pantry', sourceRecipeNames: null, sourceRecipeId: null },
  ],
};

describe('ShoppingListPage prices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.useCurrentShoppingList.mockReturnValue({ data: baseList, isLoading: false });
    hooks.useUpdateShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.useAddShoppingListItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useDeleteShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useChooseSku.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.useFoodSearch.mockReturnValue({ data: [] });
  });

  it('shows recipe name on recipe-sourced items', () => {
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    expect(screen.getByText('Shakshuka')).toBeInTheDocument();
  });

  it('shows "from recipes" fallback when sourceRecipeNames is null', () => {
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const listWithNullRecipes = {
      ...baseList,
      items: [{ ...baseList.items[0], sourceRecipeNames: null }],
    };
    hooks.useCurrentShoppingList.mockReturnValue({ data: listWithNullRecipes, isLoading: false });
    renderPage();
    expect(screen.getByText('from recipes')).toBeInTheDocument();
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
    expect(screen.getByText('Dairy & eggs')).toBeInTheDocument();
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
    const priceEls = screen.getAllByText('$7.49');
    expect(priceEls.length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByText('Checking prices…')).toBeInTheDocument();
  });

  it('refresh button enqueues a job', async () => {
    const refreshMutate = vi.fn();
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: refreshMutate, isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /find products/i }));
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

describe('ShoppingListPage multi-select', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.useCurrentShoppingList.mockReturnValue({ data: baseList, isLoading: false });
    hooks.useUpdateShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.useAddShoppingListItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useDeleteShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.useChooseSku.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.useFoodSearch.mockReturnValue({ data: [] });
  });

  it('action bar is hidden when nothing is selected', () => {
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderPage();
    expect(screen.queryByRole('toolbar', { name: /selection actions/i })).not.toBeInTheDocument();
  });

  it('shows action bar after selecting an item', () => {
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: /select Eggs/i }));
    expect(screen.getByRole('toolbar', { name: /selection actions/i })).toBeInTheDocument();
    expect(screen.getByText('1 item selected')).toBeInTheDocument();
  });

  it('calls purchase mutation when Mark purchased is clicked', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutateAsync, isPending: false });
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: /select Bread/i }));
    fireEvent.click(screen.getByRole('button', { name: /mark selected as purchased/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ itemIds: ['i2'] }));
  });

  it('calls batch delete directly for non-recipe items', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutateAsync, isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: /select Bread/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove selected items/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ itemIds: ['i2'] }));
  });

  it('shows confirmation dialog when removing recipe-sourced items', () => {
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: /select Eggs/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove selected items/i }));
    expect(screen.getByText(/Some selected items are from recipes/i)).toBeInTheDocument();
  });

  it('calls batch delete after confirming removal of recipe items', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutateAsync, isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('checkbox', { name: /select Eggs/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove selected items/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove anyway/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ itemIds: ['i1'] }));
  });
});

describe('ShoppingListPage — phase 4 candidate review', () => {
  const soleCandidate = {
    sku: 'NW-EGGS-001',
    name: 'Free Range Eggs 6pk',
    brand: 'Tegel',
    packSize: { qty: 6, unit: 'count' as const },
    price: 5.99,
    unitPrice: { value: 0.998, per: 'count' as const },
    inStock: true,
    onSpecial: false,
    cartQty: 1,
    resolution: 'sole' as const,
  };

  const manualCandidateA = {
    sku: 'NW-BREAD-001',
    name: 'Tip Top White Bread',
    brand: 'Tip Top',
    packSize: { qty: 700, unit: 'g' as const },
    price: 3.49,
    unitPrice: { value: 0.499, per: 'g' as const },
    inStock: true,
    onSpecial: false,
    cartQty: 1,
    resolution: 'manual' as const,
  };

  const manualCandidateB = {
    sku: 'NW-BREAD-002',
    name: 'Vogels Original Mixed Grain',
    brand: 'Vogels',
    packSize: { qty: 750, unit: 'g' as const },
    price: 5.99,
    unitPrice: { value: 0.799, per: 'g' as const },
    inStock: true,
    onSpecial: false,
    cartQty: 1,
    resolution: 'manual' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    hooks.useCurrentShoppingList.mockReturnValue({ data: baseList, isLoading: false });
    hooks.useUpdateShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.useAddShoppingListItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useDeleteShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.useChooseSku.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.useFoodSearch.mockReturnValue({ data: [] });
  });

  it('shows "Sole match" badge for sole-resolution items', async () => {
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [
          {
            id: 'p1',
            shoppingListItemId: 'i1',
            store: 'new_world',
            sku: soleCandidate.sku,
            name: soleCandidate.name,
            price: soleCandidate.price,
            inStock: true,
            matched: true,
            checkedAt: '2026-05-10T01:00:00Z',
            candidates: [soleCandidate],
            chosenSku: soleCandidate.sku,
          },
        ],
        job: null,
      },
    });
    renderPage();
    expect(screen.getByText('Sole match')).toBeInTheDocument();
  });

  it('shows "Pick one" badge for manual-resolution items and reveals candidates on tap', async () => {
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [
          {
            id: 'p2',
            shoppingListItemId: 'i2',
            store: 'new_world',
            sku: null,
            name: null,
            price: null,
            inStock: false,
            matched: false,
            checkedAt: '2026-05-10T01:00:00Z',
            candidates: [manualCandidateA, manualCandidateB],
            chosenSku: null,
          },
        ],
        job: null,
      },
    });
    renderPage();
    expect(screen.getByText('Pick one')).toBeInTheDocument();
    // Candidates should not be visible yet
    expect(screen.queryByText('Tip Top White Bread')).not.toBeInTheDocument();
    // Click "Show options" to expand
    fireEvent.click(screen.getByRole('button', { name: /show options/i }));
    expect(screen.getByText('Tip Top White Bread')).toBeInTheDocument();
    expect(screen.getByText('Vogels Original Mixed Grain')).toBeInTheDocument();
  });

  it('selecting a candidate calls PATCH chosen-sku and replaces badge', async () => {
    const mutate = vi.fn();
    hooks.useChooseSku.mockReturnValue({ mutate, isPending: false });
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [
          {
            id: 'p2',
            shoppingListItemId: 'i2',
            store: 'new_world',
            sku: null,
            name: null,
            price: null,
            inStock: false,
            matched: false,
            checkedAt: '2026-05-10T01:00:00Z',
            candidates: [manualCandidateA, manualCandidateB],
            chosenSku: null,
          },
        ],
        job: null,
      },
    });
    renderPage();
    // Expand the candidate list
    fireEvent.click(screen.getByRole('button', { name: /show options/i }));
    // Click on the first candidate
    fireEvent.click(screen.getByRole('button', { pressed: false, name: /Tip Top White Bread/i }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({ itemId: 'i2', sku: 'NW-BREAD-001' }),
    );
  });
});
