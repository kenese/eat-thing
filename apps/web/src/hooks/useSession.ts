import { useQuery } from '@tanstack/react-query';
import type { Session } from '@eat/shared';

const DEV_SESSION_KEY = 'eat-thing:dev-session';

function devSession(): Session | null {
  if (!isDevSessionEnabled()) {
    return null;
  }

  return {
    user: {
      id: 'dev-user',
      name: 'Local Dev',
      email: 'dev@eat-thing.local',
    },
    session: {
      id: 'dev-session',
      userId: 'dev-user',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
  };
}

export function isDevSessionEnabled() {
  return import.meta.env.DEV && window.localStorage.getItem(DEV_SESSION_KEY) === '1';
}

export function enableDevSession() {
  window.localStorage.setItem(DEV_SESSION_KEY, '1');
}

export function useSession() {
  return useQuery<Session | null>({
    queryKey: ['session'],
    queryFn: async () => {
      const localSession = devSession();
      if (localSession) return localSession;

      const res = await fetch('/api/auth/get-session', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.user ? data : null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
