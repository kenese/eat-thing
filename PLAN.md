# Plan

Living plan for eat-thing. Tasks update as we go. New work appends; completed work moves under "Done" with the date.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` deferred / dropped

**Currently on:** Handoff backlog Slice 3 complete — resume at Slice 4 shopping-list scheduled date + dynamic Recipes quick-shop copy

Execution order and acceptance criteria: [docs/superpowers/plans/2026-06-01-handoff-backlog-roadmap.md](./docs/superpowers/plans/2026-06-01-handoff-backlog-roadmap.md)

Architecture audit recommendations: [architecture-audit-recommendations.html](./architecture-audit-recommendations.html)

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

### Slice 2 — Hardening (complete)

- [x] Robustness: detect logged-out state and prompt user; retry/backoff for transient failures — _2026-06-02_
- [x] `launchd` plist so the scraper auto-starts on the Mac mini — _2026-06-02_
- [x] Fix pre-existing test failures in `scraper.test.ts` (10 tests) and `gemini.test.ts` (1 test) — `SCRAPER_HMAC_SECRET` env var name mismatch + hardcoded API key removed — _2026-05-15_

Pak'nSave and Woolworths adapters exist in `apps/scraper` but are deferred post-MVP (see [IDEAS.md](./IDEAS.md) and D21).

## Phase 3.5 — Recipe URL import improvements

- [x] Readability HTML cleaning before LLM fallback
- [x] No-paraphrase: preserve original ingredient text and units
- [x] Metric annotation: `metric_value` stored alongside original qty/unit (display only)
- [x] Hero image: OG tag → first photo img → uploaded to Supabase Storage on save
- [x] Sections: `HowToSection` schema.org support; Gemini sections in prompt; `section` column on recipe_ingredients; markdown headers in instructions

## Phase 4 — Build-to-cart (New World only)

Adds items to cart on the user's behalf. User always clicks "place order" — see [D3](./DECISIONS.md#d3--supermarket-integration-ceiling-build-to-cart).

- [x] New World "add to cart" Playwright flow — _2026-05-18_
- [x] Reconcile: confirm cart contents match shopping list, surface mismatches — _2026-05-18_
- [x] Cart-link handoff: deep link or QR back to phone for checkout — _2026-05-18_
- [x] Audit log of every scraper action (what was added, when, in which session) — _2026-05-18_

## Frontend restyle (complete) — _2026-05-11_

Pure restyle to the Crisp + Persimmon system; behaviour preserved.

- [x] Tokens + Google Fonts + global chrome (TopNav, page shell, PageTitle, FilterStrip, StatusChip, AgentStatusCard, Wordmark)
- [x] Inventory: tabular ledger + use-this-week strip + sectioned by category (was location)
- [x] Recipes: inventory-aware sections + editorial hero (lite) + image-top cards
- [x] Meal plan: proportion strip + redesigned day cards + fill-day suggestions
- [x] Shopping list: categories migration + two-pane layout + reason chips + agent status
- [x] Home dashboard: hero, use-this-week inventory strip, five-day meals strip, shopping-list preview — _2026-05-12_

## Cross-cutting / ongoing

- [ ] Telemetry: structured logs + lightweight error reporting (Sentry free tier?)
- [ ] Taxonomy expansion as new ingredients appear (interactive "add to taxonomy" prompt rather than silent insert)
- [ ] Backups: Supabase point-in-time + occasional dump to local disk
- [ ] Multi-household readiness: keep `household_id` discipline in every new query/migration

## Architecture-audit remediation — accepted 2026-06-01

Audit artifact: [architecture-audit-recommendations.html](./architecture-audit-recommendations.html)

Complete these before resuming the remaining handoff backlog. Each runtime slice must update relevant Vitest and Playwright coverage and pass `pnpm test` plus `pnpm test:e2e` before moving to Done.

### Slice A — Tenant isolation + worker contract (complete — 2026-06-01)

Moved to Done after `pnpm test` and `pnpm test:e2e` passed.

### Slice C — Recipe + inventory model alignment

- [x] Replace silent global `canonical_foods` insertion with an explicit confirm-new-food taxonomy review step — _2026-06-02_

### Decision gates

- [x] Decision Gate 1: retain public recipe URLs for operational simplicity; defer private bucket paths + signed reads — _2026-06-01_
- [x] Decision Gate 2: phase explicit confirm-new-food taxonomy review after tenant isolation and low-stock staples work — _2026-06-01_
- [x] Decision Gate 3: enforce the four-recipes-per-day rule as a server invariant — _2026-06-01_

## Handoff backlog — ordered delivery slices

Detailed roadmap: [docs/superpowers/plans/2026-06-01-handoff-backlog-roadmap.md](./docs/superpowers/plans/2026-06-01-handoff-backlog-roadmap.md)

- [x] Slice 1: wire Inventory low-stock staples sidebar widget — absorbed into architecture-audit remediation Slice B — _2026-06-02_
- [x] Slice 2: New World logged-out prompt, transient retry/backoff, and Mac-mini `launchd` service — _2026-06-02_
- [x] Slice 3: Plan load-date picker + Recipes hero next-open-day feedback — _2026-06-03_
- [ ] Slice 4: shopping-list scheduled date + dynamic Recipes quick-shop copy
- [ ] Slice 5: Plan auto-shop read-only preview + pre-flight API
- [ ] Slice 6: research and design New World delivery-window integration before implementation
- [ ] Slice 7: design and build the New World-first `/shops` route
- [ ] Spot-check tablet breakpoint during Slice 1; keep `<=768px` unless review demonstrates a problem
- [-] Restore inventory `location` field — defer until category-derived counts cause a demonstrated problem

## Deferred

- [-] Native mobile shell (Capacitor / React Native) — defer unless PWA limitations hurt
- [-] Offline writes / write queue — revisit once usage shows it matters
- [-] Private recipe-photo bucket paths + signed reads — public recipe URLs are sufficient for now; revisit if imported images may contain personal content
- [-] Auto-place orders — out of scope, see [D3](./DECISIONS.md#d3--supermarket-integration-ceiling-build-to-cart)
- [-] Learned staples / cadence from history — needs months of data, see [D7](./DECISIONS.md#d7--staples-manual-first-learned-later)

---

## Done

- 2026-06-03 — Handoff backlog Slice 3: replaced the disabled Plan load-date stub with a compact keyboard-accessible mini-calendar modal; confirming a date recenters the rolling 17-day rail and scrolls the selected day into view while local-midnight rollover keeps actual-today semantics current. Kept the Recipes hero intentionally fast: it auto-adds the featured recipe to the next open day and reports pending, success, and retry states without opening a picker. Added focused Vitest and Playwright coverage; `pnpm test` and `pnpm test:e2e` passed.
- 2026-06-02 — Handoff backlog Slice 2: hardened the New World worker with structured failure codes, bounded inline retry/backoff for transient failures, worker-authenticated retry progress reporting, Shopping List retry/session-expired states, and a production Mac-mini `launchd` plist with install notes. Verified the live New World smoke after starting the configured local API, then passed `pnpm test` and `pnpm test:e2e`. See D27 and `docs/superpowers/specs/2026-06-02-slice2-newworld-hardening-design.md`.
- 2026-06-02 — Architecture-audit remediation Slice C4: replaced silent `canonical_foods` insertion in inventory and manual shopping-list flows with a server-enforced taxonomy review step. New foods now stop with a typed `taxonomy_review_required` response, show explicit reuse/create actions in the web UI, and only create global canonical foods through a confirm step. Added targeted Vitest and Playwright coverage; `pnpm test` and `pnpm test:e2e` passed. See D26.
- 2026-06-02 — Architecture-audit remediation Slices B, C1, C2, C3, C5, and D runtime/docs pass: added shared server-side low-stock staples derivation and reused it in `POST /api/shopping-lists/from-plan` plus the Inventory sidebar; preserved manual shopping-list items while refreshing recipe/staple-derived rows; restricted inventory storage units to canonical `g` / `ml` / `count` with migration `0013_inventory_canonical_units.sql`; enforced the four-recipes-per-day rule in the meal-plan API; preserved original recipe ingredient qty/unit text while retaining metric annotations; accepted and persisted `recipes.total_time_minutes` and `recipes.tags` through recipe create/update and import paths; deleted the obsolete OpenBrain `launchd` plist; refreshed architecture/agent docs to describe mutable inventory balances, append-only cooking audit events, public recipe-photo URLs, Meal Planner HTTP MCP with stdio fallback, single-household-first middleware, Better-Auth table exceptions, pending scraper `launchd` supervision, and the still-pending taxonomy-review gate. See D25.
- 2026-06-01 — Responsive chrome correction: removed the mobile footer tab bar, kept primary navigation in the header at every width, and added an icon-only compact iPhone header with `Eat` branding while retaining the existing text header on tablet and desktop.
- 2026-06-01 — Architecture-audit remediation Slice A: added tenant ownership to `shopping_list_prices` with migration 0012; enforced direct household filtering and owned-list checks across shopping-list price/cart reads, enqueueing, selection, and mutation; rejected cross-household scraper result upserts; standardized scraper signing on `SCRAPER_HMAC_SECRET`; added shared `add_to_cart`; documented global `canonical_foods` and Better-Auth table exceptions. Also repaired stale web test copy selectors uncovered by the required full-suite run. See D24.
- 2026-05-18 — Phase 4: build-to-cart (New World only) shipped. compare_prices now returns top-N candidates with sole/preferred/manual resolutions; shopping list UI shows state badges + per-row candidate picker; new add_to_cart job diffs the live trolley (idempotent), applies via product detail pages, returns a per-item action breakdown + cart total; reconcile modal surfaces the result with an "Open New World trolley" link. See D23 and docs/superpowers/specs/2026-05-17-phase4-build-to-cart-design.md.
- 2026-05-17 — Plan refactor: replaced fixed Monday–Sunday weekly meal plan with a rolling 17-day window centred on today. Dropped `meal_plans` table and auto-generation of shopping lists (migration 0008). Plan page now renders a horizontally-scrollable rail of 17 day cards; today is always at index 2. Shopping list gets a "Add from planned recipes" modal that pre-ticks days whose entries are already in the list and calls `POST /api/shopping-lists/from-plan`. `source_recipe_id` added to `shopping_list_items` to support pre-tick matching. All unit tests (116 web, 59 server) and E2E tests (15) pass. Also fixed a pre-existing E2E crash where the Meal Planner parse mock used a numeric `qty` instead of a string, breaking `MetricControl`.
- 2026-05-16 — Removed OpenBrain sync integration entirely: `packages/openbrain` deleted, `sync_dirty` table dropped (migration 0007), `/api/sync` routes removed, `openbrain-worker` deleted, `synced` column dropped from `inventory_items`, OpenBrain tab removed from ImportModal, all fire-and-forget sync calls removed from recipe/inventory/meal-plan/cook-event routes. See D22.
- 2026-05-15 — Fixed large recipe photo imports: `/api/ingest/photo` now has a scoped 10 MB JSON parser limit, the web importer downsizes large photos before base64 upload, and multipart photo ingestion is captured in IDEAS.md as the longer-term replacement.
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
- 2026-05-15 — Shopping list multi-select + purchased action: dropped `inventory_location` enum + column (replaced by category from canonical_foods); find-or-create food helper so manual inventory + list-item additions auto-create canonical foods; `POST /items/purchase` saves selected items to inventory and removes from list (in transaction); `POST /items/batch-delete` removes multiple items at once; `InventoryPage` now tabs by category instead of location; `ItemForm` shows category dropdown when adding a new food by free text; `ShoppingListPage` replaces per-item checkbox with multi-select + sticky action bar ("Mark purchased" / "Remove" with recipe-item confirmation dialog); `AddItemForm` uses food combobox with category fallback for new foods.
