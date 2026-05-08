import { createHmac, createHash } from 'node:crypto';

/**
 * Sign an outbound request with HMAC-SHA256.
 *
 * Signature covers: METHOD + '\n' + PATH + '\n' + TIMESTAMP + '\n' + SHA256(body).
 * The server verifies the signature and rejects timestamps older than 5 minutes
 * to prevent replay attacks.
 */
export function signRequest(
  method: string,
  path: string,
  body: string,
  secret: string,
): { timestamp: string; signature: string } {
  const timestamp = Date.now().toString();
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { timestamp, signature };
}

export function buildAuthHeader(timestamp: string, signature: string): string {
  return `HMAC-SHA256 timestamp=${timestamp},sig=${signature}`;
}
