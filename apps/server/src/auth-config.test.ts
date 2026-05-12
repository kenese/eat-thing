import { describe, expect, it } from 'vitest';
import { createAuthBaseURLConfig, getAllowedWebOrigins } from './auth-config.js';

describe('auth config', () => {
  it('trusts the production custom domain even when WEB_BASE_URL is left at the local default', () => {
    const origins = getAllowedWebOrigins({
      WEB_BASE_URL: 'http://localhost:5173',
      PRODUCTION_WEB_BASE_URL: 'https://eat-thing.badvibes.cc',
    });

    expect(origins).toContain('http://localhost:5173');
    expect(origins).toContain('https://eat-thing.badvibes.cc');
  });

  it('uses a dynamic Better-Auth base URL for known app hosts', () => {
    expect(createAuthBaseURLConfig('http://localhost:3001')).toEqual({
      allowedHosts: ['localhost:3001', 'eat-thing.badvibes.cc', '*.vercel.app'],
      fallback: 'http://localhost:3001',
      protocol: 'auto',
    });
  });
});
