export type Store = 'new_world' | 'paknsave' | 'woolworths';
export type JobType = 'import_past_orders' | 'compare_prices';
export type JobStatus = 'pending' | 'in_progress' | 'done' | 'failed';

export interface ScraperJob {
  id: string;
  householdId: string;
  store: Store;
  type: JobType;
  payload: Record<string, unknown> | null;
  status: JobStatus;
  attempts: number;
  createdAt: string;
}

export interface JobResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface SessionEnvelope {
  encryptedBlob: string;
  lastLoginAt: string | null;
}
