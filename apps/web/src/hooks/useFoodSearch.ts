import { useQuery } from '@tanstack/react-query';
import type { CanonicalFood } from '@eat/shared';

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
