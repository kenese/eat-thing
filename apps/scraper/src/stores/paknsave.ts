import type { StoreAdapter } from './base.js';

// Stub — Phase 3 implementation goes here.
export const paknsaveAdapter: StoreAdapter = {
  async handle(job) {
    console.log(`[paknsave] job ${job.id} (${job.type}) — not yet implemented`);
    return { jobId: job.id, ok: false, error: 'not implemented' };
  },
};
