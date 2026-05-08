# Plan

Living plan for eat-thing. Tasks update as we go. New work appends; completed work moves under "Done" with the date.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred / dropped

**Currently on:** Phase 0 — Foundation

For per-decision rationale see [DECISIONS.md](./DECISIONS.md). For architecture see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Phase 0 — Foundation

The starter project is a generic Turborepo. Get it from "blank" to "ready to build features".

- [x] Rebrand workspaces from `@starter/*` to `@eat/*` — _2026-05-07_
- [x] Delete `extension/` (Discogs Cart+ — unrelated to eat-thing) — _2026-05-07_
- [x] Rewrite `README.md` for eat-thing (still describes the starter) — _2026-05-07_
- [x] Create Supabase project; store URL + anon/service keys in `.env` — _2026-05-07_
- [x] Add Drizzle + initial migration system — _2026-05-08_
- [x] Define core schema: `households`, `users`, `memberships`, `canonical_foods`, `inventory_items`, `recipes`, `recipe_ingredients`, `meal_plans`, `meal_plan_entries`, `shopping_lists`, `shopping_list_items`, `staples`, `cook_events`, `supermarket_credentials`, `supermarket_products`, plus `sync_dirty` (per-resource dirty flag for debounced sync) — _2026-05-08_
- [x] Create `packages/taxonomy` with seed list + unit-conversion helpers (g↔ml, tbsp↔ml, cloves↔g garlic, etc.) — _2026-05-08_
- [ ] Create `packages/openbrain` skeleton (stubbed `syncRecipe`, `syncInventorySnapshot`, `syncMealPlan`, `syncCookLog`)
- [ ] Wire Better-Auth + Google provider into `apps/server`
- [ ] Add `withHousehold` middleware (every domain query scoped by `household_id`)
- [ ] Scaffold `apps/scraper` workspace and a worker SDK that handles HMAC-signed polling against the API
- [ ] Set up PWA basics in `apps/web` (manifest, service worker via `vite-plugin-pwa`, install prompt)
- [ ] Configure Vercel deployment for `apps/web` and `apps/server`
- [x] Write `CLAUDE.md` so any new Claude session (CLI or otherwise) starts warm — _2026-05-07_

## Phase 1 — MVP

Inventory + recipes + meal plan + shopping list. Useful on its own.

- [ ] Inventory CRUD (list, add, edit, delete, search)
- [ ] Inventory item detail: brand, qty, unit, location (fridge / pantry / freezer), purchased_at, expires_at
- [ ] Recipe CRUD (manual entry only at this stage)
- [ ] Weekly meal-plan view (drag recipe onto a day, set servings)
- [ ] Shopping-list generator: Σ recipe ingredients − inventory + staples below threshold
- [ ] Mark recipe cooked → cook event → deduct ingredients from inventory
- [ ] Interactive deduct prompt for ambiguous units ("how many garlic bulbs are left?")
- [ ] Staples: flag canonical food + threshold; surfaces in shopping list when low
- [ ] Offline read cache: inventory, recipes, shopping list, meal plan in IndexedDB (TanStack Query persistence)
- [ ] OpenBrain sync wired up end-to-end: live recipe writes + debounced inventory & meal-plan snapshots + daily cook-log roll-up, all driven by the Mac-mini sync worker
- [ ] Mobile layouts for the three core screens (inventory, plan, list)

### Open questions to close during Phase 1

- [ ] Recipe photos: store original or just extracted text? (lean toward original on Supabase Storage)
- [ ] What "servings" means for a leftover-heavy household — does cooking 4 servings of a 4-serving recipe count as 1 cook event or 4?
- [ ] Debounce window length (currently assumed 5 min) — tune once we observe real usage patterns

## Phase 2 — Recipe ingestion

Make adding recipes effortless.

- [ ] URL ingestion: fetch HTML → schema.org Recipe microdata if present, else LLM extract
- [ ] Photo ingestion: upload → multimodal LLM → structured recipe JSON
- [ ] In-app recipe search: integrate one external recipe API (Spoonacular / TheMealDB — TBD)
- [ ] Ingredient → canonical_food matching with confidence + manual override
- [ ] Edit-and-confirm step before save (no silent imports)

## Phase 3 — Read-only supermarket integration

Scraper on Mac mini. Logs in, reads. No writes to the supermarket account.

- [ ] Playwright session bootstrap: headed first-run for each store to capture login cookies
- [ ] Encrypted credential / session storage (`supermarket_credentials`); encryption key lives only on the server
- [ ] Per-store adapters: New World NZ, Pak'nSave, Woolworths NZ
- [ ] Past-orders scrape → builds preferred-brand map (`supermarket_products.preferred`)
- [ ] Match shopping list against current store catalog → cost + availability per store
- [ ] Recommendation UI: cheapest store, convenient store, optional split across stores
- [ ] Robustness: detect logged-out state and prompt user; retry/backoff for transient failures
- [ ] `launchd` plists so both the scraper and the OpenBrain sync worker auto-start on the Mac mini

## Phase 4 — Build-to-cart

Adds items to cart on the user's behalf. User always clicks "place order" — see [D3](./DECISIONS.md#d3--supermarket-integration-ceiling-build-to-cart).

- [ ] Per-store "add to cart" Playwright flows
- [ ] Reconcile: confirm cart contents match shopping list, surface mismatches
- [ ] Cart-link handoff: deep link or QR back to phone for checkout
- [ ] Audit log of every scraper action (what was added, when, in which session)

## Cross-cutting / ongoing

- [ ] Telemetry: structured logs + lightweight error reporting (Sentry free tier?)
- [ ] Taxonomy expansion as new ingredients appear (interactive "add to taxonomy" prompt rather than silent insert)
- [ ] Backups: Supabase point-in-time + occasional dump to local disk
- [ ] Multi-household readiness: keep `household_id` discipline in every new query/migration; revisit OpenBrain story when a second household is real

## Deferred

- [-] Native mobile shell (Capacitor / React Native) — defer unless PWA limitations hurt
- [-] Offline writes / write queue — revisit once usage shows it matters
- [-] Auto-place orders — out of scope, see [D3](./DECISIONS.md#d3--supermarket-integration-ceiling-build-to-cart)
- [-] Learned staples / cadence from history — needs months of data, see [D7](./DECISIONS.md#d7--staples-manual-first-learned-later)

---

## Done

- 2026-05-07 — Phase 0: deleted `extension/` (Discogs Cart+), unrelated to eat-thing.
- 2026-05-07 — Phase 0: wrote `CLAUDE.md` so any new Claude session starts warm.
- 2026-05-07 — Phase 0: rebranded workspaces from `@starter/*` to `@eat/*`; rewrote `README.md` for eat-thing.
- 2026-05-07 — Phase 0: Supabase project created; env files written for server + web; `.env` added to `.gitignore`.
- 2026-05-08 — Phase 0: Drizzle ORM + drizzle-kit wired up; connected via Supabase transaction pooler (aws-1-ap-southeast-2, port 6543).
