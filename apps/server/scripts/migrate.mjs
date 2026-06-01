import 'dotenv/config';
import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required to run migrations.');
  process.exit(1);
}

const result = spawnSync('drizzle-kit', ['migrate'], {
  env: {
    ...process.env,
    DATABASE_DIRECT_URL: process.env.DATABASE_URL,
  },
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
