import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signRequest, buildAuthHeader } from './sign';

const FIXED_NOW = 1700000000000;
const SECRET = 'test-secret-key';

// Precomputed: HMAC-SHA256(secret, "POST\n/api/results\n1700000000000\n" + sha256('{"foo":"bar"}'))
const KNOWN_SIGNATURE = 'ecfbe7c6f7ebb4be39048183b73011eb7d40515a83c2c45c5321196e2f1ec637';

describe('signRequest', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a timestamp string matching Date.now()', () => {
    const { timestamp } = signRequest('GET', '/api/jobs', '', SECRET);
    expect(timestamp).toBe(String(FIXED_NOW));
  });

  it('returns a 64-char hex signature', () => {
    const { signature } = signRequest('GET', '/api/jobs', '', SECRET);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the expected HMAC for known inputs', () => {
    const { signature } = signRequest('POST', '/api/results', '{"foo":"bar"}', SECRET);
    expect(signature).toBe(KNOWN_SIGNATURE);
  });

  it('uppercases the method before signing', () => {
    const { signature: lower } = signRequest('post', '/api/results', '', SECRET);
    const { signature: upper } = signRequest('POST', '/api/results', '', SECRET);
    expect(lower).toBe(upper);
  });

  it('is deterministic for identical inputs', () => {
    const { signature: s1 } = signRequest('GET', '/api/jobs', '', SECRET);
    const { signature: s2 } = signRequest('GET', '/api/jobs', '', SECRET);
    expect(s1).toBe(s2);
  });

  it('different secrets produce different signatures', () => {
    const { signature: s1 } = signRequest('GET', '/api/jobs', '', SECRET);
    const { signature: s2 } = signRequest('GET', '/api/jobs', '', 'other-secret');
    expect(s1).not.toBe(s2);
  });

  it('different bodies produce different signatures', () => {
    const { signature: s1 } = signRequest('POST', '/api/results', '{"a":1}', SECRET);
    const { signature: s2 } = signRequest('POST', '/api/results', '{"a":2}', SECRET);
    expect(s1).not.toBe(s2);
  });

  it('different paths produce different signatures', () => {
    const { signature: s1 } = signRequest('GET', '/api/jobs', '', SECRET);
    const { signature: s2 } = signRequest('GET', '/api/other', '', SECRET);
    expect(s1).not.toBe(s2);
  });
});

describe('buildAuthHeader', () => {
  it('produces the expected HMAC-SHA256 format', () => {
    const header = buildAuthHeader('12345', 'abc123');
    expect(header).toBe('HMAC-SHA256 timestamp=12345,sig=abc123');
  });

  it('round-trips with signRequest output', () => {
    vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
    const { timestamp, signature } = signRequest('GET', '/api/jobs', '', SECRET);
    const header = buildAuthHeader(timestamp, signature);
    expect(header).toContain('HMAC-SHA256');
    expect(header).toContain(`timestamp=${timestamp}`);
    expect(header).toContain(`sig=${signature}`);
    vi.restoreAllMocks();
  });
});
