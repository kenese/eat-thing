import { getDevMockResponse } from '../dev/mockApi';
import { isDevSessionEnabled } from '../hooks/useSession';
import type { TaxonomyReviewRequiredResponse } from '@eat/shared';

export class ApiError extends Error {
  status: number;
  body: unknown;
  code?: string;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.code = typeof body === 'object' && body !== null && 'code' in body
      ? String((body as { code?: unknown }).code)
      : undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getApiErrorCode(err: unknown): string | undefined {
  if (err instanceof ApiError) return err.code;
  if (isRecord(err) && 'code' in err && typeof err.code === 'string') return err.code;
  return undefined;
}

export function getTaxonomyReviewRequiredResponse(err: unknown): TaxonomyReviewRequiredResponse | null {
  if (getApiErrorCode(err) !== 'taxonomy_review_required') return null;

  const body = err instanceof ApiError
    ? err.body
    : isRecord(err) && 'body' in err
      ? err.body
      : null;

  if (!isRecord(body)) return null;
  if (body.code !== 'taxonomy_review_required') return null;
  if (!isRecord(body.proposed) || !Array.isArray(body.matches) || typeof body.error !== 'string') return null;

  return body as unknown as TaxonomyReviewRequiredResponse;
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
    const message =
      (typeof body === 'object' && body !== null && 'message' in body && typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : undefined)
      ?? (typeof body === 'object' && body !== null && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : undefined)
      ?? `Request failed (${res.status})`;
    console.log('ApiFetch failed: ', message);
    throw new ApiError(res.status, message, body);
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
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
