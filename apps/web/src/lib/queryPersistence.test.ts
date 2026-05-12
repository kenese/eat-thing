import { describe, expect, it } from 'vitest';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { stripSessionQuery } from './queryPersistence';

describe('query persistence', () => {
  it('does not restore persisted auth session data', () => {
    const persisted = {
      timestamp: Date.now(),
      buster: '',
      clientState: {
        mutations: [],
        queries: [
          {
            queryHash: '["session"]',
            queryKey: ['session'],
            state: { data: { user: { id: 'stale-user' } } },
          },
          {
            queryHash: '["inventory"]',
            queryKey: ['inventory'],
            state: { data: [] },
          },
        ],
      },
    } as unknown as PersistedClient;

    const cleaned = stripSessionQuery(persisted);

    expect(cleaned.clientState.queries.map((query) => query.queryKey)).toEqual([['inventory']]);
  });
});
