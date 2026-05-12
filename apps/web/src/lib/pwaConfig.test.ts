import { describe, expect, it } from 'vitest';
import { pwaOptions } from './pwaConfig';

describe('pwa config', () => {
  it('does not serve the app shell for auth callback navigations', () => {
    const denylist = pwaOptions.workbox?.navigateFallbackDenylist ?? [];
    const authCallbackPath = '/api/auth/callback/google';

    expect(denylist.some((pattern) => pattern.test(authCallbackPath))).toBe(true);
  });
});
