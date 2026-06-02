export type Store = 'new_world' | 'paknsave' | 'woolworths';
export type JobType = 'import_past_orders' | 'compare_prices' | 'add_to_cart';
export type JobStatus = 'pending' | 'in_progress' | 'done' | 'failed';
export type ScraperErrorCode =
  | 'session_expired'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'navigation_timeout'
  | 'network_error'
  | 'parser_error'
  | 'invalid_payload'
  | 'no_session'
  | 'unknown';

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
  failure?: ScraperFailure;
}

export interface ScraperFailure {
  code: ScraperErrorCode;
  message: string;
  retryable: boolean;
  attempt: number;
  maxAttempts: number;
}

export interface SessionEnvelope {
  encryptedBlob: string;
  lastLoginAt: string | null;
}
