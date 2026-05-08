import { useQuery } from '@tanstack/react-query';
import type { Session } from '@eat/shared';

export function useSession() {
  return useQuery<Session | null>({
    queryKey: ['session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/get-session', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.user ? data : null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
