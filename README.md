# eat-thing

Household food management: inventory → recipes → meal plans → shopping lists → (later) NZ supermarket cart.

Built for one household, two users. Multi-tenant-clean from day one.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | Turborepo + pnpm |
| Frontend (`apps/web`) | React 19 + Vite · React Router · TanStack Query · Zustand · CSS Modules |
| Backend (`apps/server`) | Express · Better-Auth (Google OAuth) · Drizzle ORM |
| Scraper (`apps/scraper`) | Playwright on home Mac mini · HMAC-signed polling |
| Database | Postgres on Supabase |
| Storage | Supabase Storage (photos) |
| Hosting | Vercel (web + API) · Mac mini launchd (scraper + OpenBrain sync) |
| Shared types | `packages/shared` (`@eat/shared`) |
| Taxonomy + units | `packages/taxonomy` (`@eat/taxonomy`) |
| OpenBrain sync | `packages/openbrain` (`@eat/openbrain`) |

## Project structure

```
apps/
  web/        — PWA (React + Vite)
  server/     — REST API (Express + Drizzle + Better-Auth)
  scraper/    — Playwright supermarket worker (runs on Mac mini)
packages/
  shared/     — Shared TypeScript types
  taxonomy/   — Canonical food list + unit-conversion helpers
  openbrain/  — OpenBrain sync stubs
```

## Getting started

```bash
pnpm install
pnpm dev          # web on :5173, server on :3001
```

Copy `.env.example` to `.env` and fill in Supabase + Google OAuth credentials before running.

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start web + server |
| `pnpm build` | Production build for all packages |
| `pnpm test` | Vitest unit + component tests |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm storybook` | Storybook component explorer on :6006 |
| `pnpm lint` | Lint all packages |
| `pnpm clean` | Remove build artifacts |

Workspace-specific: `pnpm --filter @eat/web dev`, `pnpm --filter @eat/server dev`

## Key conventions

- All domain data scoped by `household_id`. Every query and migration must respect this.
- Inventory is a derived running balance from append-only `cook_events`. Emit new events; never edit old ones.
- Storage units are canonical (g / ml / count); the display layer handles conversion.
- TanStack Query for server state, Zustand for purely local UI state.
- `packages/openbrain` is a sync target only — no app logic reads from it.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [PLAN.md](./PLAN.md), and [DECISIONS.md](./DECISIONS.md) for full detail.
