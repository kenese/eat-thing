import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { PricesForListResponse, RefreshPricesResponse } from '@eat/shared';

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
