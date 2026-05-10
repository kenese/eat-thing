import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from './encryption.js';

const KEY = randomBytes(32).toString('base64');

describe('encrypt/decrypt', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = JSON.stringify({ cookies: [{ name: 'sid', value: 'xyz' }] });
    const ciphertext = encrypt(plaintext, KEY);
    expect(ciphertext).not.toEqual(plaintext);
    expect(decrypt(ciphertext, KEY)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encrypt('hello', KEY);
    const b = encrypt('hello', KEY);
    expect(a).not.toBe(b);
  });

  it('throws when the ciphertext is tampered with', () => {
    const ciphertext = encrypt('hello', KEY);
    const buf = Buffer.from(ciphertext, 'base64');
    buf[buf.length - 1] ^= 0x01;
    expect(() => decrypt(buf.toString('base64'), KEY)).toThrow();
  });

  it('throws when the key is wrong', () => {
    const ciphertext = encrypt('hello', KEY);
    const otherKey = randomBytes(32).toString('base64');
    expect(() => decrypt(ciphertext, otherKey)).toThrow();
  });

  it('throws if the key is not 32 bytes', () => {
    expect(() => encrypt('x', Buffer.from('short').toString('base64'))).toThrow();
  });
});
