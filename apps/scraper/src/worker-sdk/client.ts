import 'dotenv/config';
import { signedHeaders } from './sign.js';
import type { JobResult, ScraperJob, SessionEnvelope, Store } from './types.js';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001';
const SECRET = process.env.WORKER_HMAC_KEY ?? '';

async function workerFetch(method: string, path: string, body?: unknown): Promise<Response> {
  const bodyStr = body ? JSON.stringify(body) : '';
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: signedHeaders(method, path, bodyStr, SECRET),
    body: bodyStr || undefined,
  });
}

export async function fetchPendingJobs(): Promise<ScraperJob[]> {
  const res = await workerFetch('GET', '/api/scraper/jobs/pending');
  if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);
  const json = (await res.json()) as { jobs: ScraperJob[] };
  return json.jobs;
}

export async function claimJob(jobId: string): Promise<void> {
  const res = await workerFetch('POST', `/api/scraper/jobs/${jobId}/claim`);
  if (!res.ok) throw new Error(`Failed to claim job ${jobId}: ${res.status}`);
}

export async function reportJobResult(jobId: string, result: JobResult): Promise<void> {
  const res = await workerFetch('POST', `/api/scraper/jobs/${jobId}/result`, result);
  if (!res.ok) throw new Error(`Failed to report job result ${jobId}: ${res.status}`);
}

export async function fetchSession(householdId: string, store: Store): Promise<SessionEnvelope | null> {
  const res = await workerFetch('GET', `/api/scraper/session/${householdId}/${store}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`);
  return (await res.json()) as SessionEnvelope;
}

export async function postSession(householdId: string, store: Store, encryptedBlob: string): Promise<void> {
  const res = await workerFetch('POST', '/api/scraper/session', { householdId, store, encryptedBlob });
  if (!res.ok) throw new Error(`Failed to post session: ${res.status}`);
}
