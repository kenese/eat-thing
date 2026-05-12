/// <reference types="vitest/config" />
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './src/lib/pwaConfig';

export default defineConfig({
  plugins: [
    react(),
    VitePWA(pwaOptions),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/**'],
  }
});
