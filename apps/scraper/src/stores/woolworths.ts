import type { StoreAdapter } from './base.js';

// Stub — Phase 3 implementation goes here.
export const woolworthsAdapter: StoreAdapter = {
  async handle(job) {
    console.log(`[woolworths] job ${job.id} (${job.type}) — not yet implemented`);
    return { jobId: job.id, ok: false, error: 'not implemented' };
  },
};
