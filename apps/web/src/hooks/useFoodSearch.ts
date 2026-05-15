import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CanonicalFood, CreateFoodInput } from '@eat/shared';

export function useFoodSearch(q: string) {
  return useQuery<CanonicalFood[]>({
    queryKey: ['foods', q],
    queryFn: async () => {
      const res = await fetch(`/api/foods?q=${encodeURIComponent(q.trim())}&limit=10`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: q.trim().length >= 1,
    staleTime: 60_000,
  });
}

export function useCreateFood() {
  const queryClient = useQueryClient();
  return useMutation<CanonicalFood, Error, CreateFoodInput>({
    mutationFn: async (input) => {
      const res = await fetch('/api/foods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Failed to create food');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['foods'] });
    },
  });
}
