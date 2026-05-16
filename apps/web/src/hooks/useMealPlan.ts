import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { addDays, mondayOf, toIsoDate } from '../lib/dateUtils';
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
    onSuccess: async (_, vars) => {
      await api.post('/api/shopping-lists/generate', { weekStart: vars.weekStart });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['meal-plan', vars.weekStart] }),
        qc.invalidateQueries({ queryKey: ['shopping-list'] }),
      ]);
    },
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

export function useAddToNextEmptyDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { recipeId: string; servings: number }[]) => {
      if (items.length === 0) return { addedTo: [] as string[], skipped: [] as string[] };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const candidates = Array.from({ length: 28 }, (_, i) => addDays(today, i));

      const weekStartSet = new Set(candidates.map(d => toIsoDate(mondayOf(d))));
      const weekStartIsos = [...weekStartSet];

      const weekPlans = await Promise.all(
        weekStartIsos.map(ws => api.get<MealPlanWeek>(`/api/meal-plans?weekStart=${ws}`)),
      );

      const occupiedDates = new Set<string>();
      for (const plan of weekPlans) {
        for (const entry of plan.entries) {
          occupiedDates.add(entry.date);
        }
      }

      const emptyDays: { date: string; weekStart: string }[] = [];
      for (const d of candidates) {
        if (emptyDays.length >= items.length) break;
        const iso = toIsoDate(d);
        if (!occupiedDates.has(iso)) {
          emptyDays.push({ date: iso, weekStart: toIsoDate(mondayOf(d)) });
        }
      }

      const toPlace = items.slice(0, emptyDays.length);
      const skipped = items.slice(emptyDays.length);

      await Promise.all(
        toPlace.map((item, i) =>
          api.post('/api/meal-plans/entries', {
            weekStart: emptyDays[i].weekStart,
            date: emptyDays[i].date,
            recipeId: item.recipeId,
            servings: item.servings,
          }),
        ),
      );

      const affectedWeeks = [...new Set(emptyDays.map(d => d.weekStart))];
      await Promise.all(
        affectedWeeks.map(ws => api.post('/api/shopping-lists/generate', { weekStart: ws })),
      );

      await Promise.all([
        ...affectedWeeks.map(ws => qc.invalidateQueries({ queryKey: ['meal-plan', ws] })),
        qc.invalidateQueries({ queryKey: ['shopping-list'] }),
      ]);

      const addedTo = emptyDays.map(d => {
        const dt = new Date(d.date + 'T00:00:00');
        return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      });

      return { addedTo, skipped: skipped.map(i => i.recipeId) };
    },
  });
}
