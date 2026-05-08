import 'dotenv/config';
import { signRequest, buildAuthHeader } from './sign.js';
import type { JobResult, ScraperJob } from './types.js';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001';
const SECRET = process.env.SCRAPER_HMAC_SECRET ?? '';

async function signedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const body = typeof init.body === 'string' ? init.body : '';
  const { timestamp, signature } = signRequest(method, path, body, SECRET);

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildAuthHeader(timestamp, signature),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** Fetch all pending jobs assigned to this scraper. */
export async function fetchPendingJobs(): Promise<ScraperJob[]> {
  const res = await signedFetch('/api/scraper/jobs/pending');
  if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);
  return res.json() as Promise<ScraperJob[]>;
}

/** Report a job result back to the server. */
export async function reportJobResult(result: JobResult): Promise<void> {
  const body = JSON.stringify(result);
  const res = await signedFetch(`/api/scraper/jobs/${result.jobId}/result`, {
    method: 'POST',
    body,
  });
  if (!res.ok) throw new Error(`Failed to report job result: ${res.status}`);
}
