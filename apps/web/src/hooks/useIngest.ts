import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ImportedRecipe } from '@eat/shared';

export interface MealPlannerRecipePreview {
  id: string;
  title: string;
  preview: string;
  alreadyImported: boolean;
}

export function useIngestUrl() {
  return useMutation({
    mutationFn: (url: string) => api.post<ImportedRecipe>('/api/ingest/url', { url }),
  });
}

export function useIngestPhoto() {
  return useMutation({
    mutationFn: ({ imageBase64, mimeType }: { imageBase64: string; mimeType: string }) =>
      api.post<ImportedRecipe>('/api/ingest/photo', { imageBase64, mimeType }),
  });
}

export function useIngestSearch() {
  return useMutation({
    mutationFn: (q: string) => api.get<ImportedRecipe[]>(`/api/ingest/search?q=${encodeURIComponent(q)}`),
  });
}

export function useIngestMealPlannerList(enabled: boolean) {
  return useQuery({
    queryKey: ['ingest', 'meal-planner', 'list'],
    queryFn: () => api.get<MealPlannerRecipePreview[]>('/api/ingest/meal-planner'),
    enabled,
    staleTime: 60_000,
  });
}

export function useIngestMealPlannerParse() {
  return useMutation({
    mutationFn: (id: string) => api.post<ImportedRecipe>('/api/ingest/meal-planner/parse', { id }),
  });
}
