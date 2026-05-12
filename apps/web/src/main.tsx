import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createIdbPersister } from './lib/queryPersistence';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
    },
  },
});

// Restore + subscribe in the background; never blocks initial render or queries.
persistQueryClient({
  queryClient,
  persister: createIdbPersister(),
  maxAge: 1000 * 60 * 60 * 24,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.queryKey[0] !== 'session' && query.state.status === 'success',
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
