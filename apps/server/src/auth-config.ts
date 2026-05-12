const DEFAULT_SERVER_BASE_URL = 'http://localhost:3001';
const DEFAULT_WEB_BASE_URL = 'http://localhost:5173';
const PRODUCTION_WEB_BASE_URL = 'https://eat-thing.badvibes.cc';

const AUTH_ALLOWED_HOSTS = ['localhost:3001', 'eat-thing.badvibes.cc', '*.vercel.app'];

type EnvLike = Partial<Pick<NodeJS.ProcessEnv, 'WEB_BASE_URL' | 'PRODUCTION_WEB_BASE_URL' | 'BETTER_AUTH_TRUSTED_ORIGINS'>>;

function splitOriginList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getAllowedWebOrigins(env: EnvLike = process.env) {
  return Array.from(new Set([
    ...splitOriginList(env.WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL),
    ...splitOriginList(env.PRODUCTION_WEB_BASE_URL ?? PRODUCTION_WEB_BASE_URL),
    ...splitOriginList(env.BETTER_AUTH_TRUSTED_ORIGINS),
  ]));
}

export function createAuthBaseURLConfig(fallback = process.env.SERVER_BASE_URL || DEFAULT_SERVER_BASE_URL) {
  return {
    allowedHosts: AUTH_ALLOWED_HOSTS,
    fallback,
    protocol: 'auto' as const,
  };
}
