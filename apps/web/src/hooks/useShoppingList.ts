import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  ShoppingList, ShoppingListItem,
  GenerateShoppingListInput, AddShoppingListItemInput, UpdateShoppingListItemInput,
  PurchaseShoppingListItemsInput, BatchDeleteShoppingListItemsInput,
} from '@eat/shared';

interface ApiError extends Error { status: number; }

export function useCurrentShoppingList() {
  return useQuery<ShoppingList | null>({
    queryKey: ['shopping-list', 'current'],
    queryFn: async () => {
      try {
        return await api.get<ShoppingList>('/api/shopping-lists/current');
      } catch (err: unknown) {
        if ((err as ApiError).status === 404) return null;
        throw err;
      }
    },
  });
}

export function useGenerateShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateShoppingListInput) =>
      api.post<ShoppingList>('/api/shopping-lists/generate', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list'] }),
  });
}

export function useUpdateShoppingListItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...data }: UpdateShoppingListItemInput & { itemId: string }) =>
      api.put<ShoppingListItem>(`/api/shopping-lists/${listId}/items/${itemId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', 'current'] }),
  });
}

export function useAddShoppingListItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddShoppingListItemInput) =>
      api.post<ShoppingListItem>(`/api/shopping-lists/${listId}/items`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', 'current'] }),
  });
}

export function useDeleteShoppingListItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api.del<{ id: string }>(`/api/shopping-lists/${listId}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', 'current'] }),
  });
}

export function usePurchaseShoppingListItems(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PurchaseShoppingListItemsInput) =>
      api.post<ShoppingList>(`/api/shopping-lists/${listId}/items/purchase`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useBatchDeleteShoppingListItems(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchDeleteShoppingListItemsInput) =>
      api.post<ShoppingList>(`/api/shopping-lists/${listId}/items/batch-delete`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list'] }),
  });
}
