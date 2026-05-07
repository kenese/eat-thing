# eat-thing

Household food management app. Inventory ↔ recipes ↔ meal plans ↔ shopping lists, with later integration with NZ supermarkets via Playwright. One household (two users) initially; designed multi-tenant-clean from day one.

## Read these first
- [PLAN.md](./PLAN.md) — current phase, task list, what's done. **Always read before starting work.** Update as tasks change state; move done work to the Done log with the date.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — topology, data model, key flows, hosting.
- [DECISIONS.md](./DECISIONS.md) — numbered log of decisions and the reasoning behind them.

## How to work in this repo
- Any new architectural decision goes in DECISIONS.md as a new numbered entry. Don't silently change ARCHITECTURE.md without a corresponding decision.
- All domain data is scoped by `household_id`. Every query and migration must respect this.
- Inventory is a derived running balance from append-only `cook_events`. Don't edit cook events; emit new ones.
- `packages/openbrain` is a sync target only. No app logic should depend on reading from OpenBrain.
- `canonical_foods` is curated. New foods go through a taxonomy-review prompt rather than silent insert.

## Stack at a glance
- Turborepo monorepo: `apps/web` (PWA) · `apps/server` (Express + Better-Auth + Drizzle) · `apps/scraper` (Playwright on home Mac mini) · `packages/shared` · `packages/taxonomy` · `packages/openbrain`.
- Postgres on Supabase. Photos on Supabase Storage.
- Frontend + API on Vercel. Background workers (scraper, OpenBrain sync) on the home Mac mini, supervised by `launchd`. Workers poll the Vercel API outbound — no inbound port at home.
- Auth: Better-Auth with Google OAuth.
- Storage units canonical (g / ml / count); display layer converts.

## Conventions
- TanStack Query for server state. Zustand for purely local UI state.
- CSS Modules / plain CSS, co-located with components.
- Vitest + React Testing Library for components. Playwright for app-level E2E (separate from the scraper Playwright).
- Storybook for the component library.
