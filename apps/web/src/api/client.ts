interface ApiError extends Error {
  status: number;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = Object.assign(new Error(body?.error ?? `HTTP ${res.status}`), {
      status: res.status,
    }) as ApiError;
    throw err;
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
