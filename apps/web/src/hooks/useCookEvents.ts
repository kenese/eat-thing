import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { CookEventPreview, CreateCookEventInput, CookEvent } from '@eat/shared';

export function useCookPreview(mealPlanEntryId: string | null) {
  return useQuery<CookEventPreview>({
    queryKey: ['cook-preview', mealPlanEntryId],
    queryFn: () => api.get<CookEventPreview>(`/api/cook-events/preview?mealPlanEntryId=${mealPlanEntryId}`),
    enabled: !!mealPlanEntryId,
    staleTime: 0,
  });
}

export function useCreateCookEvent(weekStart: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCookEventInput) => api.post<CookEvent>('/api/cook-events', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plan', weekStart] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
