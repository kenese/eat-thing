import 'dotenv/config';
import { chromium } from 'playwright';
import { fetchPendingJobs, reportJobResult } from './worker-sdk/client.js';
import { newWorldAdapter } from './stores/newworld.js';
import { paknsaveAdapter } from './stores/paknsave.js';
import { woolworthsAdapter } from './stores/woolworths.js';
import type { StoreAdapter } from './stores/base.js';
import type { Store } from './worker-sdk/types.js';

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 30_000);

const ADAPTERS: Record<Store, StoreAdapter> = {
  new_world: newWorldAdapter,
  paknsave: paknsaveAdapter,
  woolworths: woolworthsAdapter,
};

async function tick(): Promise<void> {
  let jobs;
  try {
    jobs = await fetchPendingJobs();
  } catch (err) {
    console.error('Poll failed:', err);
    return;
  }

  if (jobs.length === 0) return;

  console.log(`Claimed ${jobs.length} job(s)`);
  const browser = await chromium.launch({ headless: true });

  try {
    for (const job of jobs) {
      const adapter = ADAPTERS[job.store];
      const result = await adapter.handle(job, browser);
      await reportJobResult(result);
    }
  } finally {
    await browser.close();
  }
}

console.log(`Scraper worker started — polling every ${POLL_INTERVAL_MS / 1000}s`);
tick();
setInterval(tick, POLL_INTERVAL_MS);
