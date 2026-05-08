export type Store = 'new_world' | 'paknsave' | 'woolworths';

export type JobType = 'scrape_products' | 'build_cart';

export interface ScraperJob {
  id: string;
  householdId: string;
  store: Store;
  type: JobType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface JobResult {
  jobId: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
