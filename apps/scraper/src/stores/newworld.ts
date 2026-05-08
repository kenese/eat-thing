import type { StoreAdapter } from './base.js';

// Stub — Phase 3 implementation goes here.
// Will handle: login (headed first run), product search, price scraping.
export const newWorldAdapter: StoreAdapter = {
  async handle(job) {
    console.log(`[new_world] job ${job.id} (${job.type}) — not yet implemented`);
    return { jobId: job.id, ok: false, error: 'not implemented' };
  },
};
