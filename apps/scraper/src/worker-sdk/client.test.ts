import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

describe('worker SDK client', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('signs requests with SCRAPER_HMAC_SECRET', async () => {
    vi.stubEnv('SCRAPER_HMAC_SECRET', 'canonical-secret');
    vi.stubEnv('WORKER_HMAC_KEY', 'obsolete-secret');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobs: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { fetchPendingJobs } = await import('./client.js');
    await fetchPendingJobs();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const timestamp = headers['X-Worker-Timestamp'];
    const expected = createHmac('sha256', 'canonical-secret')
      .update(`GET\n/api/scraper/jobs/pending\n${timestamp}\n`)
      .digest('hex');
    expect(headers['X-Worker-Signature']).toBe(expected);
  });
});
