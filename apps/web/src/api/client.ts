import { getDevMockResponse } from '../dev/mockApi';
import { isDevSessionEnabled } from '../hooks/useSession';

interface ApiError extends Error {
  status: number;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  console.log('apiFetch', path, init);
  if (isDevSessionEnabled() && (!init?.method || init.method === 'GET')) {
    const mockResponse = getDevMockResponse(path);
    if (mockResponse !== null) return mockResponse as T;
  }

  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch((e) => {
      console.log('client error json fail', e);
      return e;
    });
    console.log('ApiFetch failed: ', body?.message);
    throw new Error('ApiFetch failed with error: ' + body?.message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
