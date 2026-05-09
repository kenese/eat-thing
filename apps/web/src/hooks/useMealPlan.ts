import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  MealPlanWeek,
  MealPlanEntry,
  CreateMealPlanEntryInput,
  UpdateMealPlanEntryInput,
} from '@eat/shared';

export function useMealPlanWeek(weekStart: string) {
  return useQuery<MealPlanWeek>({
    queryKey: ['meal-plan', weekStart],
    queryFn: () => api.get<MealPlanWeek>(`/api/meal-plans?weekStart=${weekStart}`),
    enabled: !!weekStart,
  });
}

export function useAddMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMealPlanEntryInput) =>
      api.post<{ mealPlanId: string; entry: MealPlanEntry }>('/api/meal-plans/entries', data),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['meal-plan', vars.weekStart] }),
  });
}

export function useUpdateMealPlanEntry(weekStart: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateMealPlanEntryInput & { id: string }) =>
      api.put<MealPlanEntry>(`/api/meal-plans/entries/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan', weekStart] }),
  });
}

export function useDeleteMealPlanEntry(weekStart: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/api/meal-plans/entries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan', weekStart] }),
  });
}
