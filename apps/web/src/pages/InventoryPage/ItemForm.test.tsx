import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ItemForm } from './ItemForm';
import type { InventoryRow } from '@eat/shared';

const hooks = vi.hoisted(() => ({
  useFoodSearch: vi.fn(),
  useAddInventoryItem: vi.fn(),
  useUpdateInventoryItem: vi.fn(),
  useCreateFood: vi.fn(),
}));

vi.mock('../../hooks/useFoodSearch', () => ({
  useFoodSearch: hooks.useFoodSearch,
  useCreateFood: hooks.useCreateFood,
}));

vi.mock('../../hooks/useInventory', () => ({
  useAddInventoryItem: hooks.useAddInventoryItem,
  useUpdateInventoryItem: hooks.useUpdateInventoryItem,
}));

describe('ItemForm taxonomy review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.useFoodSearch.mockReturnValue({ data: [] });
    hooks.useUpdateInventoryItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('shows taxonomy review actions and can reuse an existing canonical food', async () => {
    const mutateAsync = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Taxonomy review required'), {
        status: 409,
        code: 'taxonomy_review_required',
        body: {
          code: 'taxonomy_review_required',
          error: 'Taxonomy review required',
          proposed: { name: 'Dish Soap', category: 'other', defaultUnit: 'count' },
          matches: [{ id: 'food-1', name: 'Dish soap', category: 'other', defaultUnit: 'count' }],
        },
      }))
      .mockResolvedValueOnce({});
    hooks.useAddInventoryItem.mockReturnValue({ mutateAsync, isPending: false });
    hooks.useCreateFood.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    render(<ItemForm mode="add" onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/food/i), { target: { value: 'Dish Soap' } });
    fireEvent.change(screen.getByLabelText(/quantity/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));

    await screen.findByText(/review this new canonical food before saving/i);
    fireEvent.click(screen.getByRole('button', { name: /use existing: dish soap/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenLastCalledWith(expect.objectContaining({
      canonicalFoodId: 'food-1',
      qty: 1,
      unit: 'g',
    })));
  });

  it('submits category changes when editing an inventory item', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    hooks.useAddInventoryItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useUpdateInventoryItem.mockReturnValue({ mutateAsync, isPending: false });
    hooks.useCreateFood.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });

    const item: InventoryRow = {
      id: 'item-1',
      householdId: 'hh-1',
      canonicalFoodId: 'food-1',
      foodName: 'firm tofu',
      qty: 2,
      unit: 'count',
      brand: null,
      category: 'other',
      purchasedAt: null,
      expiresAt: null,
      createdAt: '2026-06-09T00:00:00.000Z',
      updatedAt: '2026-06-09T00:00:00.000Z',
    };

    render(<ItemForm mode="edit" item={item} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'pantry' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      qty: 2,
      unit: 'count',
      category: 'pantry',
    })));
  });
});
