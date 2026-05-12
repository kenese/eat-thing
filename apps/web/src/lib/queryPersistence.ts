import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

const IDB_KEY = 'eat-thing-query-cache';

export function stripSessionQuery(client: PersistedClient): PersistedClient {
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.filter((query) => query.queryKey[0] !== 'session'),
    },
  };
}

export function createIdbPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(IDB_KEY, stripSessionQuery(client));
    },
    restoreClient: async () => {
      const client = await get<PersistedClient>(IDB_KEY);
      return client ? stripSessionQuery(client) : undefined;
    },
    removeClient: async () => {
      await del(IDB_KEY);
    },
  };
}
