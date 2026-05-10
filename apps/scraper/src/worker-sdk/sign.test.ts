import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { signRequest, signedHeaders } from './sign.js';

describe('signRequest', () => {
  it('produces a deterministic signature for the same inputs', () => {
    const { timestamp, signature } = signRequest('GET', '/api/scraper/jobs/pending', '', 'sekret');
    const expected = createHmac('sha256', 'sekret')
      .update(`GET\n/api/scraper/jobs/pending\n${timestamp}\n`)
      .digest('hex');
    expect(signature).toBe(expected);
  });

  it('uppercases the method and includes the body verbatim', () => {
    const body = JSON.stringify({ ok: true });
    const { timestamp, signature } = signRequest('post', '/api/scraper/session', body, 'sekret');
    const expected = createHmac('sha256', 'sekret')
      .update(`POST\n/api/scraper/session\n${timestamp}\n${body}`)
      .digest('hex');
    expect(signature).toBe(expected);
  });

  it('different secrets produce different signatures', () => {
    const { signature: s1 } = signRequest('GET', '/api/jobs', '', 'key-a');
    const { signature: s2 } = signRequest('GET', '/api/jobs', '', 'key-b');
    expect(s1).not.toBe(s2);
  });

  it('different bodies produce different signatures', () => {
    const { signature: s1 } = signRequest('POST', '/api/x', '{"a":1}', 'k');
    const { signature: s2 } = signRequest('POST', '/api/x', '{"a":2}', 'k');
    expect(s1).not.toBe(s2);
  });
});

describe('signedHeaders', () => {
  it('returns the three headers the server expects', () => {
    const headers = signedHeaders('GET', '/x', '', 'k');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Worker-Timestamp']).toMatch(/^\d+$/);
    expect(headers['X-Worker-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });
});
