import { describe, expect, it, vi } from 'vitest';
import {
  classifyWorkerFailure,
  retryDelayMs,
  runWithRetries,
  shouldRetryFailure,
} from './retry.js';

describe('classifyWorkerFailure', () => {
  it('marks session_expired as non-retryable', () => {
    expect(classifyWorkerFailure({ ok: false, error: 'session_expired' }, 1, 3)).toMatchObject({
      code: 'session_expired',
      retryable: false,
      attempt: 1,
      maxAttempts: 3,
    });
  });

  it('marks Playwright navigation timeouts as retryable', () => {
    expect(classifyWorkerFailure(new Error('page.goto: Timeout 15000ms exceeded'), 2, 3)).toMatchObject({
      code: 'navigation_timeout',
      retryable: true,
      attempt: 2,
      maxAttempts: 3,
    });
  });

  it('marks HTTP 429 and upstream 5xx failures as retryable', () => {
    expect(classifyWorkerFailure(new Error('HTTP 429'), 1, 3).code).toBe('rate_limited');
    expect(classifyWorkerFailure(new Error('HTTP 503'), 1, 3).code).toBe('upstream_unavailable');
  });
});

describe('retryDelayMs', () => {
  it('uses the agreed 1s then 3s schedule', () => {
    expect(retryDelayMs(2)).toBe(1000);
    expect(retryDelayMs(3)).toBe(3000);
  });
});

describe('shouldRetryFailure', () => {
  it('retries only retryable failures with attempts remaining', () => {
    expect(shouldRetryFailure({
      code: 'network_error', message: 'Network error', retryable: true, attempt: 1, maxAttempts: 3,
    })).toBe(true);
    expect(shouldRetryFailure({
      code: 'network_error', message: 'Network error', retryable: true, attempt: 3, maxAttempts: 3,
    })).toBe(false);
    expect(shouldRetryFailure({
      code: 'session_expired', message: 'Session expired', retryable: false, attempt: 1, maxAttempts: 3,
    })).toBe(false);
  });
});

describe('runWithRetries', () => {
  it('reports retry progress before sleeping and succeeds on a later attempt', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockResolvedValueOnce({ ok: true, data: { items: [] } });
    const onRetry = vi.fn();
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await runWithRetries(operation, { onRetry, sleep });

    expect(result).toEqual({ ok: true, data: { items: [] } });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({
      code: 'network_error',
      attempt: 2,
      maxAttempts: 3,
    }));
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('returns permanent failures immediately', async () => {
    const operation = vi.fn().mockResolvedValue({ ok: false, error: 'session_expired' });
    const onRetry = vi.fn();

    const result = await runWithRetries(operation, { onRetry });

    expect(operation).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      error: 'session_expired',
      failure: { code: 'session_expired', retryable: false, attempt: 1, maxAttempts: 3 },
    });
  });
});
