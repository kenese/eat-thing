import { decrypt } from './encryption.js';
import { fetchSession } from './worker-sdk/client.js';
import type { Store } from './worker-sdk/types.js';

// Use Playwright's own BrowserContextOptions['storageState'] shape.
// We store the raw JSON that `context.storageState()` produces and
// pass it back verbatim via `browser.newContext({ storageState })`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StorageState = any;

export async function loadStorageState(householdId: string, store: Store): Promise<StorageState | null> {
  const key = process.env.SUPERMARKET_ENC_KEY;
  if (!key) throw new Error('SUPERMARKET_ENC_KEY not set');
  const envelope = await fetchSession(householdId, store);
  if (!envelope) return null;
  const plaintext = decrypt(envelope.encryptedBlob, key);
  return JSON.parse(plaintext) as StorageState;
}
