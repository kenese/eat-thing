import { describe, expect, it } from 'vitest';
import { getAuthBaseURL } from './auth-client';

describe('auth client', () => {
  it('uses the API origin in dev so Better-Auth state cookies match the callback origin', () => {
    expect(getAuthBaseURL({
      origin: 'http://localhost:5173',
      dev: true,
      configuredBaseURL: undefined,
    })).toBe('http://localhost:3001');
  });

  it('uses the current origin in production', () => {
    expect(getAuthBaseURL({
      origin: 'https://eat-thing.badvibes.cc',
      dev: false,
      configuredBaseURL: undefined,
    })).toBe('https://eat-thing.badvibes.cc');
  });

  it('allows an explicit auth base URL override', () => {
    expect(getAuthBaseURL({
      origin: 'http://localhost:5173',
      dev: true,
      configuredBaseURL: 'http://127.0.0.1:4000',
    })).toBe('http://127.0.0.1:4000');
  });
});
