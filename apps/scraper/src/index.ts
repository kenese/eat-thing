import 'dotenv/config';
import { chromium } from 'playwright';
import { fetchPendingJobs, claimJob, reportJobProgress, reportJobResult } from './worker-sdk/client.js';
import { newWorldAdapter } from './stores/newworld.js';
import { paknsaveAdapter } from './stores/paknsave.js';
import { woolworthsAdapter } from './stores/woolworths.js';
import { runWithRetries } from './retry.js';
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
    console.error('[scraper] poll failed:', err);
    return;
  }

  if (jobs.length === 0) return;
  console.log(`[scraper] claimed ${jobs.length} job(s)`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const job of jobs) {
      try {
        await claimJob(job.id);
        const adapter = ADAPTERS[job.store];
        const result = await runWithRetries(
          () => adapter.handle(job, browser),
          {
            onRetry: async failure => {
              console.warn(
                `[scraper] job ${job.id} (${job.type}) retrying after ${failure.code}: attempt ${failure.attempt} of ${failure.maxAttempts}`,
              );
              try {
                await reportJobProgress(job.id, failure);
              } catch (err) {
                console.error(`[scraper] failed to report retry progress for ${job.id}:`, err);
              }
            },
          },
        );
        await reportJobResult(job.id, result);
        console.log(`[scraper] job ${job.id} (${job.type}) ${result.ok ? 'done' : `failed: ${result.error}`}`);
      } catch (err) {
        console.error(`[scraper] job ${job.id} threw:`, err);
        try {
          await reportJobResult(job.id, { ok: false, error: err instanceof Error ? err.message : String(err) });
        } catch (reportErr) {
          console.error(`[scraper] failed to report failure for ${job.id}:`, reportErr);
        }
      }
    }
  } finally {
    await browser.close();
  }
}

console.log(`[scraper] worker started — polling every ${POLL_INTERVAL_MS / 1000}s`);
tick();
setInterval(tick, POLL_INTERVAL_MS);
