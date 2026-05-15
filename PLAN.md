# Plan

Living plan for eat-thing. Tasks update as we go. New work appends; completed work moves under "Done" with the date.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred / dropped

**Currently on:** Phase 3 — Read-only supermarket integration (Phase 2 complete 2026-05-10)

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
- [x] Create `packages/openbrain` skeleton (stubbed `syncRecipe`, `syncInventorySnapshot`, `syncMealPlan`, `syncCookLog`) — _2026-05-08_
- [x] Wire Better-Auth + Google provider into `apps/server` — _2026-05-08_
- [x] Add `withHousehold` middleware (every domain query scoped by `household_id`) — _2026-05-08_
- [x] Scaffold `apps/scraper` workspace and a worker SDK that handles HMAC-signed polling against the API — _2026-05-08_
- [x] Set up PWA basics in `apps/web` (manifest, service worker via `vite-plugin-pwa`, install prompt) — _2026-05-08_
- [x] Configure Vercel deployment for `apps/web` and `apps/server` — _2026-05-08_
- [x] Write `CLAUDE.md` so any new Claude session (CLI or otherwise) starts warm — _2026-05-07_
- [x] Add unit + E2E tests for all Phase 0 functionality; strip starter tests — _2026-05-08_

## Phase 1 — MVP

Inventory + recipes + meal plan + shopping list. Useful on its own.

- [x] Inventory CRUD (list, add, edit, delete, search) — _2026-05-08_
- [x] Inventory item detail: brand, qty, unit, location (fridge / pantry / freezer), purchased_at, expires_at — _2026-05-08_
- [x] Recipe CRUD (manual entry only at this stage) — _2026-05-08_
- [x] Weekly meal-plan view (drag recipe onto a day, set servings) — _2026-05-08_
- [x] Shopping-list generator: Σ recipe ingredients − inventory + staples below threshold — _2026-05-09_
- [x] Mark recipe cooked → cook event → deduct ingredients from inventory — _2026-05-09_
- [x] Interactive deduct prompt for ambiguous units ("how many garlic bulbs are left?") — _2026-05-09_
- [x] Staples: flag canonical food + threshold; surfaces in shopping list when low — _2026-05-09_
- [x] Offline read cache: inventory, recipes, shopping list, meal plan in IndexedDB (TanStack Query persistence) — _2026-05-09_
- [x] OpenBrain sync wired up end-to-end: live recipe writes + debounced inventory & meal-plan snapshots + daily cook-log roll-up, all driven by the Mac-mini sync worker — _2026-05-09_
- [x] Mobile layouts for the three core screens (inventory, plan, list) — _2026-05-09_

### Open questions to close during Phase 1

- [ ] Recipe photos: store original or just extracted text? (lean toward original on Supabase Storage)
- [ ] What "servings" means for a leftover-heavy household — does cooking 4 servings of a 4-serving recipe count as 1 cook event or 4?
- [ ] Debounce window length (currently assumed 5 min) — tune once we observe real usage patterns

## Phase 2 — Recipe ingestion

Make adding recipes effortless.

- [x] URL ingestion: fetch HTML → schema.org Recipe microdata if present, else LLM extract — _2026-05-10_
- [x] Photo ingestion: upload → multimodal LLM → structured recipe JSON — _2026-05-10_
- [x] In-app recipe search: TheMealDB (free, no key, 300+ recipes) — _2026-05-10_
- [x] Ingredient → canonical_food matching with confidence + manual override — _2026-05-10_
- [x] Edit-and-confirm step before save (no silent imports) — _2026-05-10_
- [x] Bulk import from OpenBrain: "OpenBrain" tab in ImportModal, semantic search for recipe thoughts, already-imported flag, edit-and-confirm flow — _2026-05-11_ (see D18)

## Phase 3 — Read-only supermarket integration

Scraper on Mac mini. Logs in, reads. No writes to the supermarket account. Built one store at a time so the architecture is shaped by real adapters, not guesses.

### Slice 1 — New World vertical (complete)

- [x] Encrypted credential storage; AES-256-GCM, key on the Mac mini only — _2026-05-10_
- [x] Bootstrap: headed `bootstrap:newworld` (laptop) + `bootstrap:ingest` (mini) — _2026-05-10_
- [x] `scraper_jobs` queue + lifecycle endpoints (pending / claim / result), aligned to existing OpenBrain HMAC scheme — _2026-05-10_
- [x] New World adapter: search + past-orders parsers + `handle()` dispatch — _2026-05-10_
- [x] Hybrid catalog matching with preferred-brand bias — _2026-05-10_
- [x] Inline price + availability column on the existing `ShoppingListPage` — _2026-05-10_
- [x] First-run login + smoke test against live New World — _2026-05-15_

### Slice 2 — Hardening (next)

- [ ] Robustness: detect logged-out state and prompt user; retry/backoff for transient failures
- [ ] `launchd` plists so both the scraper and the OpenBrain sync worker auto-start on the Mac mini

Pak'nSave and Woolworths adapters exist in `apps/scraper` but are deferred post-MVP (see [IDEAS.md](./IDEAS.md) and D21).

## Phase 3.5 — Recipe URL import improvements

- [x] Readability HTML cleaning before LLM fallback
- [x] No-paraphrase: preserve original ingredient text and units
- [x] Metric annotation: `metric_value` stored alongside original qty/unit (display only)
- [x] Hero image: OG tag → first photo img → uploaded to Supabase Storage on save
- [x] Sections: `HowToSection` schema.org support; Gemini sections in prompt; `section` column on recipe_ingredients; markdown headers in instructions

## Phase 4 — Build-to-cart (New World only)

Adds items to cart on the user's behalf. User always clicks "place order" — see [D3](./DECISIONS.md#d3--supermarket-integration-ceiling-build-to-cart).

- [ ] New World "add to cart" Playwright flow
- [ ] Reconcile: confirm cart contents match shopping list, surface mismatches
- [ ] Cart-link handoff: deep link or QR back to phone for checkout
- [ ] Audit log of every scraper action (what was added, when, in which session)

## Frontend restyle (complete) — _2026-05-11_

Pure restyle to the Crisp + Persimmon system; behaviour preserved.

- [x] Tokens + Google Fonts + global chrome (TopNav, page shell, PageTitle, FilterStrip, StatusChip, AgentStatusCard, Wordmark)
- [x] Inventory: tabular ledger + use-this-week strip + sectioned by location
- [x] Recipes: inventory-aware sections + editorial hero (lite) + image-top cards
- [x] Meal plan: proportion strip + redesigned day cards + fill-day suggestions
- [x] Shopping list: categories migration + two-pane layout + reason chips + agent status
- [x] Home dashboard: hero, use-this-week inventory strip, five-day meals strip, shopping-list preview — _2026-05-12_

Deferred (own specs): Shops nav destination, scan-receipt, print, delivery-window picker, per-meal reason pills, send-to-store CTA, `time`/`tags` on recipes, mobile re-cut.

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

- 2026-05-14 — Fixed meal-plan → shopping-list freshness: adding a recipe to the current week now regenerates and invalidates the derived shopping list so missing ingredients appear without a manual Generate step.
- 2026-05-07 — Phase 0: deleted `extension/` (Discogs Cart+), unrelated to eat-thing.
- 2026-05-07 — Phase 0: wrote `CLAUDE.md` so any new Claude session starts warm.
- 2026-05-07 — Phase 0: rebranded workspaces from `@starter/*` to `@eat/*`; rewrote `README.md` for eat-thing.
- 2026-05-07 — Phase 0: Supabase project created; env files written for server + web; `.env` added to `.gitignore`.
- 2026-05-08 — Phase 0: Drizzle ORM + drizzle-kit wired up; connected via Supabase transaction pooler (aws-1-ap-southeast-2, port 6543).
- 2026-05-08 — Phase 1: Inventory CRUD complete — server routes (GET/POST/PUT/DELETE /api/inventory, GET /api/foods), shared types, web UI (auth guard, login page, inventory list + location tabs + search, add/edit modal with food combobox, expiry badges). `packages/taxonomy` seeded into `canonical_foods` via `db:seed`.
- 2026-05-08 — Phase 1: Recipe CRUD complete — server routes (GET list/detail, POST, PUT, DELETE /api/recipes) replacing recipe + recipe_ingredients in one transaction; shared `Recipe`/`RecipeSummary` types; web UI (`RecipesPage` list + search, `RecipeForm` modal with name/servings/source URL/instructions and an ingredient picker reusing `useFoodSearch`). Manual entry only — URL/photo ingestion lands in Phase 2.
- 2026-05-08 — Phase 1: Weekly meal-plan view complete — server routes (GET /api/meal-plans?weekStart, POST/PUT/DELETE /entries) lazily creating the `meal_plans` row on first entry; shared `MealPlanWeek`/`MealPlanEntry` types; `PlanPage` with prev/next week nav, draggable recipe sidebar, 7-day grid as drop targets, fallback "tap +" picker for non-DnD use, inline servings edit, and entry delete. Tests cover the date math and route validation.
- 2026-05-09 — Phase 1: Shopping-list generator complete — server routes (GET /api/shopping-lists, POST /api/shopping-lists/generate, PATCH /item/:id, DELETE /item/:id); generates items by Σ recipe ingredients for the current week minus on-hand inventory; `ShoppingListPage` with generate button, check-off, and delete. Staples routes and `StaplesModal` for flagging canonical foods with thresholds; staples below threshold surface in the generated list.
- 2026-05-09 — Phase 1: Cook events complete — server routes (GET/POST /api/cook-events); `CookModal` in `PlanPage` walks through each recipe ingredient with current inventory qty shown and optional per-ingredient override; emits a `cook_event` row and deducts quantities. Interactive deduct prompt handles ambiguous units inline.
- 2026-05-09 — Phase 1: Offline read cache complete — `idb-keyval` IDB persister wired to TanStack Query via `persistQueryClient` (background restore, no query blocking); 24 h gcTime + maxAge; `@tanstack/react-query-persist-client` upgraded to 5.100.x to match peer dep.
- 2026-05-09 — Phase 1: Mobile layouts complete — responsive CSS added for `PlanPage` (horizontal scroll-snap day columns, sidebar becomes horizontal row), `InventoryPage` (stacked header/actions), `ShoppingListPage` (column header, grid add-form).
- 2026-05-09 — Phase 1: OpenBrain sync complete
- 2026-05-10 — Phase 2: Recipe ingestion complete — /api/ingest/url (schema.org ld+json → Claude haiku fallback), /api/ingest/photo (Claude haiku multimodal), /api/ingest/search (TheMealDB); food-matcher with exact/alias/contains/LLM tiers returning confidence; ImportModal with URL/Photo/Search tabs + edit-and-confirm step prefilling RecipeForm; low-confidence ingredients highlighted in amber. Photos saved to Supabase Storage (eat-thing bucket) on recipe save. @anthropic-ai/sdk added to server. — `sync_dirty` table with INSERT…ON CONFLICT debounce; inventory/meal-plan/recipe routes fire markDirty after writes; `/api/sync` endpoints (pending, claim, complete, snapshots) gated by HMAC-SHA256 using `req.originalUrl`; `packages/openbrain` MCP client singleton + typed sync functions with `eat-thing:` external-ID scheme; `openbrain-worker` poller + `launchd` plist template for Mac mini.
- 2026-05-10 — Phase 3 slice 1: New World vertical landed (encrypted sessions + jobs lifecycle + parser + matcher + price column). Headed bootstrap and live smoke pending user.
- 2026-05-11 — Phase 3 slice 2: Pak'nSave + Woolworths adapters landed (parsers, fixtures, bootstrap, smoke). Deferred from MVP per D21 — see IDEAS.md.
- 2026-05-15 — Phase 3 slice 1: New World smoke test passing against live site. Selector refresh for new React/Next.js DOM structure (data-testid attributes, split price elements).
- 2026-05-15 — Phase 3.5: Recipe URL import improvements landed — Readability cleaning, no-paraphrase prompt, metric annotation (display-only), hero image extraction + upload, sections support (schema.org HowToSection + Gemini sections schema + section column on recipe_ingredients).
- 2026-05-12 — Frontend restyle follow-up: Home dashboard landed as `/`, composing inventory expiry, five-day meal readiness, and shopping-list preview. E2E now asserts the home route instead of the old inventory redirect.
- 2026-05-13 — Meal Planner recipe import from the OpenBrain ecosystem landed: structured list + parse endpoints, dedicated `@eat/meal-planning` adapter, import modal tab, edit-and-confirm flow, unit + E2E coverage.
