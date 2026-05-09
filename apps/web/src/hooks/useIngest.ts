import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ImportedRecipe } from '@eat/shared';

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
