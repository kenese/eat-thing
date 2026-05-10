import { vi, describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt } from './encryption.js';

const KEY = randomBytes(32).toString('base64');
process.env.SUPERMARKET_ENC_KEY = KEY;

const mocks = vi.hoisted(() => ({ fetchSession: vi.fn() }));
vi.mock('./worker-sdk/client.js', () => ({ fetchSession: mocks.fetchSession }));

const { loadStorageState } = await import('./session.js');

describe('loadStorageState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when the server has no session for this household/store', async () => {
    mocks.fetchSession.mockResolvedValue(null);
    const result = await loadStorageState('hh-1', 'new_world');
    expect(result).toBeNull();
  });

  it('decrypts the blob and parses the storage state JSON', async () => {
    const storage = { cookies: [{ name: 'sid', value: 'xyz', domain: '.newworld.co.nz', path: '/' }], origins: [] };
    mocks.fetchSession.mockResolvedValue({
      encryptedBlob: encrypt(JSON.stringify(storage), KEY),
      lastLoginAt: '2026-05-10T00:00:00.000Z',
    });
    const result = await loadStorageState('hh-1', 'new_world');
    expect(result).toEqual(storage);
  });

  it('throws if the blob cannot be decrypted', async () => {
    mocks.fetchSession.mockResolvedValue({ encryptedBlob: 'not-valid-base64-blob', lastLoginAt: null });
    await expect(loadStorageState('hh-1', 'new_world')).rejects.toThrow();
  });
});
