import type { JobResult, ScraperErrorCode, ScraperFailure } from './worker-sdk/types.js';

export const MAX_JOB_ATTEMPTS = 3;

const NON_RETRYABLE_CODES = new Set<ScraperErrorCode>([
  'session_expired',
  'parser_error',
  'invalid_payload',
  'no_session',
  'unknown',
]);

function isJobResult(value: unknown): value is JobResult {
  return typeof value === 'object' && value !== null && 'ok' in value;
}

function normalizeCode(err: unknown): ScraperErrorCode {
  const text = isJobResult(err)
    ? err.error ?? 'unknown'
    : err instanceof Error
      ? err.message
      : String(err);

  if (text === 'session_expired') return 'session_expired';
  if (text === 'invalid_payload') return 'invalid_payload';
  if (text === 'no_session') return 'no_session';
  if (text === 'parser_error') return 'parser_error';
  if (/\b429\b/.test(text)) return 'rate_limited';
  if (/\b5\d\d\b/.test(text)) return 'upstream_unavailable';
  if (/timeout/i.test(text)) return 'navigation_timeout';
  if (/fetch failed|network|socket|econn|enotfound/i.test(text)) return 'network_error';
  return 'unknown';
}

export function classifyWorkerFailure(err: unknown, attempt: number, maxAttempts: number): ScraperFailure {
  const code = normalizeCode(err);
  const message = isJobResult(err)
    ? err.failure?.message ?? err.error ?? 'Unknown scraper error'
    : err instanceof Error
      ? err.message
      : String(err);

  return {
    code,
    message,
    retryable: !NON_RETRYABLE_CODES.has(code),
    attempt,
    maxAttempts,
  };
}

export function retryDelayMs(nextAttempt: number): number {
  return nextAttempt <= 2 ? 1000 : 3000;
}

export function shouldRetryFailure(failure: ScraperFailure): boolean {
  return failure.retryable && failure.attempt < failure.maxAttempts;
}

interface RetryOptions {
  maxAttempts?: number;
  onRetry?: (failure: ScraperFailure) => Promise<void> | void;
  sleep?: (ms: number) => Promise<void>;
}

export async function runWithRetries(
  operation: () => Promise<JobResult>,
  options: RetryOptions = {},
): Promise<JobResult> {
  const maxAttempts = options.maxAttempts ?? MAX_JOB_ATTEMPTS;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      if (result.ok) return result;

      const failure = classifyWorkerFailure(result, attempt, maxAttempts);
      if (!shouldRetryFailure(failure)) return { ok: false, error: failure.code, failure };

      await options.onRetry?.({ ...failure, attempt: attempt + 1 });
      await sleep(retryDelayMs(attempt + 1));
    } catch (err) {
      const failure = classifyWorkerFailure(err, attempt, maxAttempts);
      if (!shouldRetryFailure(failure)) return { ok: false, error: failure.code, failure };

      await options.onRetry?.({ ...failure, attempt: attempt + 1 });
      await sleep(retryDelayMs(attempt + 1));
    }
  }

  throw new Error('Retry loop exhausted without a result');
}
