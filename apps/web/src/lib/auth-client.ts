import { createAuthClient } from 'better-auth/react';

type AuthBaseURLOptions = {
  origin: string;
  dev: boolean;
  configuredBaseURL?: string;
};

export function getAuthBaseURL({ origin, dev, configuredBaseURL }: AuthBaseURLOptions) {
  if (configuredBaseURL) return configuredBaseURL;
  return dev ? 'http://localhost:3001' : origin;
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL({
    origin: window.location.origin,
    dev: import.meta.env.DEV,
    configuredBaseURL: import.meta.env.VITE_AUTH_BASE_URL,
  }),
});
