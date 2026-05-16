import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { addDays, toIsoDate } from '../lib/dateUtils';
import type {
  MealPlanEntry,
  MealPlanEntriesResponse,
  CreateMealPlanEntryInput,
  UpdateMealPlanEntryInput,
} from '@eat/shared';

export function useMealPlanEntries(from: string, to: string) {
  return useQuery<MealPlanEntriesResponse>({
    queryKey: ['meal-plan-entries', from, to],
    queryFn: () => api.get<MealPlanEntriesResponse>(`/api/meal-plans/entries?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
}

export function useAddMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMealPlanEntryInput) =>
      api.post<MealPlanEntry>('/api/meal-plans/entries', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plan-entries'] });
    },
  });
}

export function useUpdateMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateMealPlanEntryInput & { id: string }) =>
      api.put<MealPlanEntry>(`/api/meal-plans/entries/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan-entries'] }),
  });
}

export function useDeleteMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/api/meal-plans/entries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan-entries'] }),
  });
}

export function useAddToNextEmptyDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { recipeId: string; servings: number }[]) => {
      if (items.length === 0) return { addedTo: [] as string[], skipped: [] as string[] };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const candidates = Array.from({ length: 28 }, (_, i) => addDays(today, i));
      const from = toIsoDate(today);
      const to = toIsoDate(addDays(today, 27));

      const { entries } = await api.get<MealPlanEntriesResponse>(`/api/meal-plans/entries?from=${from}&to=${to}`);
      const occupiedDates = new Set<string>(entries.map(e => e.date));

      const emptyDays: string[] = [];
      for (const d of candidates) {
        if (emptyDays.length >= items.length) break;
        const iso = toIsoDate(d);
        if (!occupiedDates.has(iso)) emptyDays.push(iso);
      }

      const toPlace = items.slice(0, emptyDays.length);
      const skipped = items.slice(emptyDays.length);

      await Promise.all(
        toPlace.map((item, i) =>
          api.post('/api/meal-plans/entries', {
            date: emptyDays[i],
            recipeId: item.recipeId,
            servings: item.servings,
          }),
        ),
      );

      await qc.invalidateQueries({ queryKey: ['meal-plan-entries'] });

      const addedTo = emptyDays.map(d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      });

      return { addedTo, skipped: skipped.map(i => i.recipeId) };
    },
  });
}
