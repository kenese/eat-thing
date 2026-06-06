# eat-thing

Household food management app. Inventory ↔ recipes ↔ meal plans ↔ shopping lists, with later integration with NZ supermarkets via Playwright. One household (two users) initially; designed multi-tenant-clean from day one.

## Read these first
- [PLAN.md](./PLAN.md) — current phase, task list, what's done. **Always read before starting work.** Update as tasks change state; move done work to the Done log with the date.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — topology, data model, key flows, hosting.
- [DECISIONS.md](./DECISIONS.md) — numbered log of decisions and the reasoning behind them.

## How to work in this repo
- Any new architectural decision goes in DECISIONS.md as a new numbered entry. Don't silently change ARCHITECTURE.md without a corresponding decision.
- All domain data is scoped by `household_id`. Every query and migration must respect this.
- Inventory is stored as mutable balance rows; `cook_events` are append-only cooking audit records. Don't edit cook events; emit new ones.
- `packages/meal-planning` is the Meal Planner import adapter only. Keep runtime ownership in eat-thing; don't make core app logic depend on Meal Planner as a source of truth.
- `canonical_foods` is curated. Inventory and manual shopping-list flows must go through the explicit taxonomy-review prompt; don't add new silent insert paths.

## Stack at a glance
- Turborepo monorepo: `apps/web` (PWA) · `apps/server` (Express + Better-Auth + Drizzle) · `apps/scraper` (Playwright on home Mac mini) · `packages/shared` · `packages/taxonomy` · `packages/meal-planning`.
- Postgres on Supabase. Photos on Supabase Storage.
- Frontend + API on Vercel. `apps/scraper` runs on the home Mac mini under `launchd` supervision. Meal Planner import runs from the server via HTTP MCP when configured, with local stdio fallback. Workers poll the Vercel API outbound — no inbound port at home.
- Auth: Better-Auth with Google OAuth.
- Storage units canonical (g / ml / count); display layer converts.

## Conventions
- TanStack Query for server state. Zustand for purely local UI state.
- CSS Modules / plain CSS, co-located with components.
- Vitest + React Testing Library for components. Playwright for app-level E2E (separate from the scraper Playwright).
- Storybook for the component library.

## Design system — "Crisp + Persimmon"
The system is real and tokenized. Honour it on every UI change; don't reinvent values per page.

- **Single source of truth: `apps/web/src/styles/tokens.css`.** Never hardcode hex, font-size, weight, letter-spacing, radius, or spacing in component CSS — reference a token. If the value you need isn't a token, **add it to tokens.css** rather than inlining a one-off.
- **Type scale is tokenized (`--text-*`).** Section headers are **28px (`--text-section`)** — decided 2026-06-01, do **not** revert to 22px. Page titles 56px (`--text-page-title`, 40px mobile). Card titles 18–19px. Use the role tokens, not raw px.
- **Persimmon period.** Every page title and section header ends with `<span class="dot">.</span>`. Where a section has an accent (fresh-green / persimmon / green), the period carries it — set the accent inline on the `.dot`, not via a leading dot element.
- **Eyebrows are lowercase in source.** `.eyebrow` / `.page-title-eyebrow` apply `text-transform: uppercase` in CSS. Never call `.toUpperCase()` in JS for display strings.
- **Status-chip semantics are fixed:** fresh-green = `cook now`, persimmon = `needs shop` / `missing N`, ink = `leftover`, dashed-mute = `open seat`. Don't introduce new chip colors or meanings.
- **Aisle/section labels come from `AISLE_LABEL` in `@eat/taxonomy`** (Produce / Butcher / Dairy & cheese / Pantry & oils / Frozen / Drinks / Other). Never hardcode them. `CATEGORY_LABEL` is the *separate* form/inventory taxonomy set — don't conflate the two.
- **Row action affordances are hover-reveal** (pattern: `.inv-row-actions`, opacity 0→1 on `:hover`/`:focus-within`), not always-visible. **Exception (D30):** dense card rails use click-to-expand instead — the **plan day-cards** collapse to label/thumbnail/name/chip and reveal servings + ingredients-needed + actions in a floating `.day-tray` (fixed, anchored to the card, overlays content below) on click. `--text-chip-sm` (9px) sizes the chip on that surface.
- **Emoji-free.** Unicode glyphs (`⌕ → ·`) + inline SVG only; no icon library.
- **Reuse the utilities** in `index.css`: `.caption-serif`, `.eyebrow`, `.dot`, `.btn-outline--on-dark`.
- **`design_handoff_eat_thing/` is a frozen reference snapshot.** The live pages + tokens.css supersede it. Read it for intent; never edit it to change the system, and note its store names are US placeholders — the real product is NZ (New World / Pak'nSave / Woolworths, D21).
- **Changing a design decision?** Log it in DECISIONS.md and update this section in the same change. Keep CLAUDE.md and AGENTS.md identical.

## Testing — required before calling work done
- **Update tests alongside the change.** Any task that adds, changes, or removes behaviour must update the relevant unit tests (Vitest) and E2E tests (Playwright) in the same change. New behaviour → new tests. Changed behaviour → updated assertions. Removed behaviour → deleted tests. If a change genuinely needs no test update, say so explicitly in the summary.
- **Run the full suite before declaring a task complete.** From the repo root:
  - `pnpm test` — runs all unit tests across the monorepo via Turbo.
  - `pnpm test:e2e` — runs Playwright E2E.
  Both must pass. Do not mark a task done, write a "✅ complete" summary, or commit on the user's behalf while either is failing or unrun.
- **If tests can't be run** (missing env, broken local setup, out-of-scope failure), state that explicitly with the reason — do not claim success.
- This rule applies to every task in PLAN.md unless the task itself is purely docs/config with no runtime effect.
