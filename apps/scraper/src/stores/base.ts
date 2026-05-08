import type { Browser } from 'playwright';
import type { JobResult, ScraperJob } from '../worker-sdk/types.js';

export interface StoreAdapter {
  /** Handle a job dispatched to this store. */
  handle(job: ScraperJob, browser: Browser): Promise<JobResult>;
}
