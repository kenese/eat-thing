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
- `canonical_foods` is curated. New foods go through a taxonomy-review prompt rather than silent insert.

## Stack at a glance
- Turborepo monorepo: `apps/web` (PWA) · `apps/server` (Express + Better-Auth + Drizzle) · `apps/scraper` (Playwright on home Mac mini) · `packages/shared` · `packages/taxonomy`.
- Postgres on Supabase. Photos on Supabase Storage.
- Frontend + API on Vercel. Background workers (scraper) on the home Mac mini, supervised by `launchd`. Workers poll the Vercel API outbound — no inbound port at home.
- Auth: Better-Auth with Google OAuth.
- Storage units canonical (g / ml / count); display layer converts.

## Database migrations
- Use `pnpm --filter @eat/server db:migrate` to apply migrations — not `db:push`. `db:push` is broken on this project (drizzle-kit v0.31.10 crashes when introspecting the DB schema).
- When creating a migration manually, also add the entry to `drizzle/meta/_journal.json`.

## Conventions
- TanStack Query for server state. Zustand for purely local UI state.
- CSS Modules / plain CSS, co-located with components.
- Vitest + React Testing Library for components. Playwright for app-level E2E (separate from the scraper Playwright).
- Storybook for the component library.

## Testing — required before calling work done
- **Update tests alongside the change.** Any task that adds, changes, or removes behaviour must update the relevant unit tests (Vitest) and E2E tests (Playwright) in the same change. New behaviour → new tests. Changed behaviour → updated assertions. Removed behaviour → deleted tests. If a change genuinely needs no test update, say so explicitly in the summary.
- **Run the full suite before declaring a task complete.** From the repo root:
  - `pnpm test` — runs all unit tests across the monorepo via Turbo.
  - `pnpm test:e2e` — runs Playwright E2E.
  Both must pass. Do not mark a task done, write a "✅ complete" summary, or commit on the user's behalf while either is failing or unrun.
- **If tests can't be run** (missing env, broken local setup, out-of-scope failure), state that explicitly with the reason — do not claim success.
- This rule applies to every task in PLAN.md unless the task itself is purely docs/config with no runtime effect.
