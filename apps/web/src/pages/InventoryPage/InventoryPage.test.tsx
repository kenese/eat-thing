import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InventoryPage } from './InventoryPage';

const hooks = vi.hoisted(() => ({
  useInventory: vi.fn(),
  useDeleteInventoryItem: vi.fn(),
  useLowStockStaples: vi.fn(),
}));

vi.mock('../../hooks/useInventory', () => ({
  useInventory: hooks.useInventory,
  useDeleteInventoryItem: hooks.useDeleteInventoryItem,
}));

vi.mock('../../hooks/useStaples', () => ({
  useLowStockStaples: hooks.useLowStockStaples,
}));

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.useDeleteInventoryItem.mockReturnValue({ mutate: vi.fn() });
    hooks.useInventory.mockReturnValue({
      data: [
        {
          id: 'inv-1',
          canonicalFoodId: 'food-apples',
          foodName: 'Apples',
          category: 'produce',
          qty: 3,
          unit: 'count',
          brand: null,
          purchasedAt: '2026-06-01T00:00:00.000Z',
          expiresAt: null,
        },
      ],
      isLoading: false,
      isError: false,
    });
    hooks.useLowStockStaples.mockReturnValue({
      data: [
        {
          id: 'staple-rice',
          canonicalFoodId: 'food-rice',
          foodName: 'Rice',
          thresholdQty: 1000,
          thresholdUnit: 'g',
          currentQty: 250,
          neededQty: 750,
        },
      ],
      isLoading: false,
    });
  });

  it('renders low-stock staples from the shared server derivation', () => {
    render(<InventoryPage />);

    expect(screen.getByText('Low staples')).toBeInTheDocument();
    expect(screen.getByText('Rice')).toBeInTheDocument();
    expect(screen.getByText('750 g needed')).toBeInTheDocument();
  });
});
