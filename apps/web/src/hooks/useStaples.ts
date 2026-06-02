import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Staple, CreateStapleInput, UpdateStapleInput } from '@eat/shared';

export interface LowStockStaple {
  id: string;
  householdId: string;
  canonicalFoodId: string;
  foodName: string;
  thresholdQty: number;
  thresholdUnit: string;
  currentQty: number;
  neededQty: number;
}

export function useStaples() {
  return useQuery<Staple[]>({
    queryKey: ['staples'],
    queryFn: () => api.get<Staple[]>('/api/staples'),
  });
}

export function useLowStockStaples() {
  return useQuery<LowStockStaple[]>({
    queryKey: ['staples', 'low-stock'],
    queryFn: () => api.get<LowStockStaple[]>('/api/staples/low-stock'),
  });
}

export function useCreateStaple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStapleInput) => api.post<Staple>('/api/staples', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staples'] });
      qc.invalidateQueries({ queryKey: ['staples', 'low-stock'] });
    },
  });
}

export function useUpdateStaple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateStapleInput & { id: string }) =>
      api.put<Staple>(`/api/staples/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staples'] });
      qc.invalidateQueries({ queryKey: ['staples', 'low-stock'] });
    },
  });
}

export function useDeleteStaple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/api/staples/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staples'] });
      qc.invalidateQueries({ queryKey: ['staples', 'low-stock'] });
    },
  });
}
