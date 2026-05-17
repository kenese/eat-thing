import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { PricesForListResponse, RefreshPricesResponse, SendToCartResponse, CartResultResponse } from '@eat/shared';

export function usePricesForList(listId: string | null | undefined) {
  return useQuery<PricesForListResponse>({
    queryKey: ['shopping-list-prices', listId],
    queryFn: () => api.get<PricesForListResponse>(`/api/shopping-lists/${listId}/prices`),
    enabled: !!listId,
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status;
      return status === 'pending' || status === 'in_progress' ? 5000 : false;
    },
  });
}

export function useRefreshPrices(listId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<RefreshPricesResponse>(`/api/shopping-lists/${listId}/refresh-prices`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list-prices', listId] });
    },
  });
}

export function useChooseSku(listId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, sku }: { itemId: string; sku: string }) =>
      api.patch<{ ok: true; chosenSku: string }>(`/api/shopping-lists/items/${itemId}/chosen-sku`, { sku }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list-prices', listId] });
    },
  });
}

export function useSendToCart(listId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SendToCartResponse>(`/api/shopping-lists/${listId}/send-to-cart`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list-cart-result', listId] }),
  });
}

export function useCartResult(listId: string | null | undefined, opts?: { pollMs?: number }) {
  return useQuery<CartResultResponse>({
    queryKey: ['shopping-list-cart-result', listId],
    queryFn: () => api.get<CartResultResponse>(`/api/shopping-lists/${listId}/cart-result`),
    enabled: !!listId,
    refetchInterval: query => {
      const status = query.state.data?.job?.status;
      return status === 'pending' || status === 'in_progress' ? (opts?.pollMs ?? 4000) : false;
    },
  });
}
