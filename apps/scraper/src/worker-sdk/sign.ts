import { createHmac } from 'node:crypto';

export function signRequest(
  method: string,
  path: string,
  body: string,
  secret: string,
): { timestamp: string; signature: string } {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { timestamp, signature };
}

export function signedHeaders(method: string, path: string, body: string, secret: string): Record<string, string> {
  const { timestamp, signature } = signRequest(method, path, body, secret);
  return {
    'X-Worker-Timestamp': timestamp,
    'X-Worker-Signature': signature,
    'Content-Type': 'application/json',
  };
}
