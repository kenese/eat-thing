import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { InventoryRow, CreateInventoryItemInput, UpdateInventoryItemInput } from '@eat/shared';

interface InventoryParams {
  category?: string;
  q?: string;
}

export function useInventory(params?: InventoryParams) {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.q) qs.set('q', params.q);
  const query = qs.toString();

  return useQuery<InventoryRow[]>({
    queryKey: ['inventory', params],
    queryFn: () => api.get<InventoryRow[]>(`/api/inventory${query ? `?${query}` : ''}`),
  });
}

export function useAddInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInventoryItemInput) =>
      api.post<InventoryRow>('/api/inventory', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useUpdateInventoryItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInventoryItemInput) =>
      api.put<InventoryRow>(`/api/inventory/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/api/inventory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}
