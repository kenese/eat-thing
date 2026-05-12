import type { VitePWAOptions } from 'vite-plugin-pwa';

export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  includeAssets: ['icon.svg'],
  manifest: {
    name: 'eat-thing',
    short_name: 'eat-thing',
    description: 'Household food management — inventory, recipes, meal plans, shopping lists.',
    theme_color: '#0f0f1a',
    background_color: '#0f0f1a',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      // TODO: add 192×192 and 512×512 PNGs for full browser support
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      {
        // API calls: network-first, fall back to cache for offline reads
        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          networkTimeoutSeconds: 10,
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
};
