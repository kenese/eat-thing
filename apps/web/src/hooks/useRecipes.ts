import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Recipe, RecipeSummary, CreateRecipeInput, UpdateRecipeInput } from '@eat/shared';

interface RecipesParams {
  q?: string;
}

export function useRecipes(params?: RecipesParams) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  const query = qs.toString();

  return useQuery<RecipeSummary[]>({
    queryKey: ['recipes', params],
    queryFn: () => api.get<RecipeSummary[]>(`/api/recipes${query ? `?${query}` : ''}`),
  });
}

export function useRecipe(id: string | null) {
  return useQuery<Recipe>({
    queryKey: ['recipe', id],
    queryFn: () => api.get<Recipe>(`/api/recipes/${id}`),
    enabled: !!id,
  });
}

export function useAddRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRecipeInput) => api.post<Recipe>('/api/recipes', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

export function useUpdateRecipe(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateRecipeInput) => api.put<Recipe>(`/api/recipes/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipes'] });
      qc.invalidateQueries({ queryKey: ['recipe', id] });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/api/recipes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}
