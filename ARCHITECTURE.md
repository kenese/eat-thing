# eat-thing — Architecture

Household food management: inventory, recipes, meal planning, auto-generated shopping lists, and supermarket integration via Playwright.

For per-decision rationale see [DECISIONS.md](./DECISIONS.md). For the rolling task list see [PLAN.md](./PLAN.md).

> **Maintenance note (2026-06-01):** refreshed to current state — removed the dropped `meal_plans` table and `inventory_items.location` column, added the `total_time_minutes`/`tags` recipe fields, `source_recipe_id` on shopping-list items, the `shopping_list_prices` / `scraper_jobs` tables, and corrected the frontend conventions to the Crisp + Persimmon system (the old "Inter / dark theme" note predated the 2026-05 restyle).

---

## Topology

```
┌──────────────────────┐                  ┌──────────────────────┐
│  apps/web (PWA)      │ ─── HTTPS ──────▶│  apps/server         │
│  React 19 + Vite     │   (Better-Auth   │  Express, on Vercel  │
│  IndexedDB cache     │    cookies)      │  ─ queues jobs       │
│  on Vercel           │                  │                      │
└──────────────────────┘                  └──────────┬───────────┘
                                                     │ Postgres + Storage
                                                     ▼
                                          ┌──────────────────────┐
                                          │  Supabase            │
                                          │  Postgres + Storage  │
                                          └──────────────────────┘

┌────────────────────────────────────────────────┐
│  Home Mac mini (always-on, launchd-supervised) │
│                                                │
│  apps/scraper ────────▶ New World NZ (V3/V4)   │
│   (Playwright,           Pak'nSave / Woolworths│
│    residential IP)        adapters deferred,D21)│
│                                                │
│  Meal Planner import ─────▶ Meal Planner MCP   │
│   (one-off structured recipe import)           │
└──────────┬─────────────────────────────────────┘
           │ outbound HTTPS poll for pending jobs
           │ (no inbound port at home)
           ▼
      Vercel API
```

## Workspaces

```
eat-thing/
├── apps/
│   ├── web/          mobile-first PWA
│   ├── server/       Express REST + auth
│   └── scraper/      Playwright worker, runs on Mac mini
├── packages/
│   ├── shared/       cross-cutting types & zod schemas
│   ├── taxonomy/     canonical foods + unit conversion
│   └── meal-planning/ Meal Planner import adapter
```

> `packages/openbrain` was removed (see D22); `extension/` (legacy Discogs starter) was deleted in Phase 0.

## Data model

Every domain table carries `household_id` and is filtered by request middleware. Primary keys are uuid.

| Table                      | Notes                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| `households`               | One row per household                                                  |
| `users`                    | Linked to Google identity by Better-Auth                               |
| `memberships`              | n:m users ↔ households (with role: owner / member)                     |
| `canonical_foods`          | id, name, default_unit, aliases[], density_g_per_ml?, **category** — taxonomy seeds; category is the source of inventory/aisle grouping |
| `inventory_items`          | canonical_food_id, qty, unit, brand?, purchased_at, expires_at — **no `location` column** (the `inventory_location` enum was dropped 2026-05-15; grouping derives from `canonical_foods.category`) |
| `recipes`                  | name, source_url?, source_image?, instructions, servings, **total_time_minutes?**, **tags[]** (migration 0009) |
| `recipe_ingredients`       | recipe_id, canonical_food_id, qty, unit, optional, section?, metric_value? (display-only) |
| `meal_plan_entries`        | date, recipe_id, servings, status (planned / cooked / skipped) — **date-keyed directly**; the `meal_plans` (week_start) parent table was dropped in migration 0008 (rolling 17-day window, 2026-05-17) |
| `shopping_lists`           | one current list per household; built from planned recipes via `POST /api/shopping-lists/from-plan` (auto-generation from a meal-plan id was removed) |
| `shopping_list_items`      | canonical_food_id, qty, unit, source (recipe / staple / manual), **source_recipe_id?**, source_recipe_names? |
| `staples`                  | canonical_food_id, threshold_qty, threshold_unit                       |
| `cook_events`              | meal_plan_entry_id, cooked_at, deductions JSONB, prompts_resolved      |
| `supermarket_credentials`  | store, encrypted_session_blob, last_login_at                           |
| `supermarket_products`     | store, sku, canonical_food_id, brand, last_seen_price, preferred       |
| `shopping_list_prices`     | one row per (shopping_list_item, store): price, matched, in_stock, candidates JSONB, chosen_sku (Phase 4, D23) |
| `scraper_jobs`             | type, status (pending → in_progress → done / failed), payload, result JSONB |

## Key flows

### Add recipe
1. User submits (manual / URL / photo / search / Meal Planner import)
2. Server normalizes ingredients → `canonical_foods` (asks user to disambiguate any unmatched item)
3. Recipe saved

### Plan + generate shopping list
1. User places recipes on dates in the rolling plan view (any date holds up to 4 recipes)
2. User adds planned recipes to the list via the "Add from planned recipes" modal → `POST /api/shopping-lists/from-plan` (pre-ticks days whose entries are already on the list)
3. List = Σ recipe ingredients − current inventory + staples below threshold; editable before finalizing

### Compare prices + build to cart (New World only — D21)
1. Server enqueues a `compare_prices` job; Mac-mini scraper picks it up
2. Scraper logs in (cookies cached), looks up each shopping-list item, returns top-N `ProductCandidate[]` per item ranked by per-100g/ml unit price (D23)
3. UI shows per-item price/availability + a candidate picker for `manual` items
4. A second `add_to_cart` job diffs the live trolley (idempotent) and writes the cart; user always clicks "place order"

> Multi-store comparison (cheapest / convenient / split-shop across Pak'nSave + Woolworths) is post-MVP — adapters exist but are unwired (see IDEAS.md and D21).

### Cook a meal
1. User marks a meal-plan entry cooked
2. Server proposes deductions from inventory based on recipe ingredients
3. UI prompts only on ambiguous units ("how many garlic bulbs are left?") — recorded as `cook_event.prompts_resolved`, refining future deductions
4. Inventory is updated

## Auth & multi-tenancy

- Better-Auth with the Google provider; session cookies on the API origin.
- Every request resolves an active `household_id` via the user's `memberships`. A user may belong to multiple households later; one exists today.
- All API handlers go through a `withHousehold` middleware that injects `household_id` into queries. There is no domain table without it.

## Offline strategy

- **Now:** PWA caches inventory, recipes, current shopping list, and current meal plan in IndexedDB via TanStack Query persistence. Reads work offline; writes require a connection.
- **Later:** Add a write queue with conflict resolution (last-write-wins per row; cook events as append-only).

## Playwright worker (`apps/scraper`)

- Runs on the home Mac mini (residential IP, always on).
- Pulls jobs from the API over an authenticated channel (HMAC-signed requests).
- Per-store adapters live in `apps/scraper/src/stores/{newworld,paknsave,woolworths}.ts`. Only New World is wired for MVP (D21).
- Sessions persisted as encrypted cookie blobs in `supermarket_credentials` (AES-256-GCM, key on the mini only — D17). First login per store is two-step: a headed `bootstrap:newworld` runs on the user's laptop and writes a plaintext `storageState`; the user copies it to the mini, where `bootstrap:ingest` encrypts and POSTs. Subsequent runs are headless and decrypt on the mini.
- Job model: `scraper_jobs` (pending → in_progress → done | failed) with type-specific payloads. Types: `import_past_orders` (one-shot per store), `compare_prices` (per shopping list), `add_to_cart` (Phase 4, diffs the live trolley).
- Per-item price snapshots + candidates in `shopping_list_prices` (one row per (item, store), upserted on each comparison).
- Read-only in V3, build-to-cart in V4. **Never places orders** (D3).

## Frontend conventions

- React 19 + Vite + React Router.
- TanStack Query for server state. Zustand for purely local UI state.
- Co-located plain CSS; design tokens in `apps/web/src/styles/tokens.css`.
- **Design system: "Crisp + Persimmon"** (landed 2026-05-11/12; full tokens in `design_handoff_eat_thing/README.md`):
  - **Type:** Schibsted Grotesk (UI, 400/600/700/800) + Lora (display + italic accents). Recurring move: page/section titles end with a persimmon period.
  - **Color:** paper `#f3f5f2`, ink `#0d1714`, persimmon accent `#d96e2e` (CTAs, "needs shop"), fresh green `#5aa758` ("cook now"), workhorse green `#1f5d33`.
  - **Chrome:** ink TopNav on desktop (hidden ≤768px), floating blurred BottomTabBar on mobile.
  - Emoji-free; unicode glyphs + inline SVG only.
- Vitest + React Testing Library for components; Playwright for app-level E2E (separate from the scraper Playwright).
- Storybook for the component library.

## Hosting & ops

- **Frontend + API:** Vercel (`apps/web` and `apps/server`).
- **DB + storage:** Supabase free tier — Postgres for domain data, Storage for recipe / inventory photos. Rows hold storage paths; URLs are signed on read.
- **Background workers:** `apps/scraper` on the home Mac mini, supervised by `launchd`. Polls the Vercel API outbound for pending jobs — no inbound port is exposed at home.
- **Worker auth:** Mac mini holds a long-lived shared secret used to sign job-queue requests (HMAC).
- **Secrets:**
  - Vercel: OAuth client ID/secret, Supabase anon/service keys, HMAC key for worker auth.
  - Mac mini: HMAC key, encryption key for supermarket session blobs (D17).

## Conventions specific to eat-thing

- All units are normalized to canonical units in storage (g for mass, ml for volume, count for count). The display layer converts back to the user's preferred unit.
- Cook events are append-only and the source of truth for "what happened". Inventory is a derived running balance — if it ever disagrees with reality, the fix is a new event, not an edit.
- `canonical_foods` grows organically. New items added through the app should always go to taxonomy review, not silent inserts, so the canonical list stays curated.

## Commands (Root)

| Command | Description |
| --- | --- |
| `pnpm dev` | Frontend (5173) + backend (3001) via Turborepo |
| `pnpm dev:scraper` | Scraper worker (run on the Mac mini) |
| `pnpm build` | Production build for all packages |
| `pnpm test` | Vitest unit + component tests |
| `pnpm test:e2e` | Playwright app-level E2E |
| `pnpm storybook` | Storybook (6006) |
| `pnpm clean` | Remove `dist/` and `.turbo/` |
