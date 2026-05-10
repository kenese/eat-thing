# eat-thing — Architecture

Household food management: inventory, recipes, meal planning, auto-generated shopping lists, and (later) supermarket integration via Playwright. Designed to live alongside OpenBrain (sync target, not source of truth).

For per-decision rationale see [DECISIONS.md](./DECISIONS.md). For the rolling task list see [PLAN.md](./PLAN.md).

---

## Topology

```
┌──────────────────────┐                  ┌──────────────────────┐
│  apps/web (PWA)      │ ─── HTTPS ──────▶│  apps/server         │
│  React 19 + Vite     │   (Better-Auth   │  Express, on Vercel  │
│  IndexedDB cache     │    cookies)      │  ─ marks dirty +     │
│  on Vercel           │                  │    queues jobs       │
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
│  apps/scraper ────────▶ NW / Pak'nSave /       │
│   (Playwright,           Woolworths NZ (V3+)   │
│    residential IP)                             │
│                                                │
│  OpenBrain sync worker ────▶ OpenBrain (MCP)   │
│   (debounced ~5 min,                           │
│    daily cook-log roll-up)                     │
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
│   ├── web/          mobile-first PWA (existing, extend)
│   ├── server/       Express REST + auth + OpenBrain sync (existing, extend)
│   └── scraper/      Playwright worker, runs on Mac mini  ← NEW
├── packages/
│   ├── shared/       cross-cutting types & zod schemas
│   ├── taxonomy/     canonical foods + unit conversion    ← NEW
│   └── openbrain/    OpenBrain sync adapter                ← NEW
└── extension/        legacy starter content (Discogs) — to be deleted
```

## Data model

Every domain table carries `household_id` and is filtered by request middleware. Primary keys are uuid.

| Table                      | Notes                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| `households`               | One row per household                                                  |
| `users`                    | Linked to Google identity by Better-Auth                               |
| `memberships`              | n:m users ↔ households (with role: owner / member)                     |
| `canonical_foods`          | id, name, default_unit, aliases[], density_g_per_ml? — taxonomy seeds  |
| `inventory_items`          | canonical_food_id, qty, unit, brand?, location, purchased_at, expires_at |
| `recipes`                  | name, source_url?, source_image?, instructions, servings               |
| `recipe_ingredients`       | recipe_id, canonical_food_id, qty, unit, optional                      |
| `meal_plans`               | week_start                                                             |
| `meal_plan_entries`        | date, recipe_id, servings, status (planned / cooked / skipped)         |
| `shopping_lists`           | generated_from_meal_plan_id                                            |
| `shopping_list_items`      | canonical_food_id, qty, unit, source (recipe / staple / manual)        |
| `staples`                  | canonical_food_id, threshold_qty, threshold_unit                       |
| `cook_events`              | meal_plan_entry_id, cooked_at, deductions JSONB, prompts_resolved      |
| `supermarket_credentials`  | store, encrypted_session_blob, last_login_at                           |
| `supermarket_products`     | store, sku, canonical_food_id, brand, last_seen_price, preferred       |

## Key flows

### Add recipe
1. User submits (manual / URL / photo / search)
2. Server normalizes ingredients → `canonical_foods` (asks user to disambiguate any unmatched item)
3. Recipe saved
4. `packages/openbrain` syncs the recipe to OpenBrain immediately

### Plan the week + generate shopping list
1. User drags recipes onto days in the meal-plan view
2. Server computes shopping list = Σ recipe ingredients − current inventory + staples below threshold
3. List is editable before finalizing

### Compare supermarkets (V3)
1. Server enqueues a job; Mac-mini scraper picks it up
2. Scraper logs in (cookies cached) to each store, looks up each shopping-list item, tags brand preferences from past orders
3. Returns per-store totals + per-item availability
4. UI shows: cheapest store, convenient store, optional split-shop

### Cook a meal
1. User marks a meal-plan entry cooked
2. Server proposes deductions from inventory based on recipe ingredients
3. UI prompts only on ambiguous units ("how many garlic bulbs are left?") — answer is recorded as a `cook_event.prompts_resolved`, refining future deductions
4. Inventory is updated; nightly OpenBrain sync picks it up

## Auth & multi-tenancy

- Better-Auth with the Google provider; session cookies on the API origin.
- Every request resolves an active `household_id` via the user's `memberships`. A user may belong to multiple households later; one exists today.
- All API handlers go through a `withHousehold` middleware that injects `household_id` into queries. There is no domain table without it.

## Offline strategy

- **MVP:** PWA caches inventory, recipes, current shopping list, and current meal plan in IndexedDB via TanStack Query persistence. Reads work offline; writes require a connection.
- **Later:** Add a write queue with conflict resolution (last-write-wins per row; cook events as append-only).

## OpenBrain sync (`packages/openbrain`)

The adapter is the only place that knows about MCP. Swapping brains = new adapter. Every sync writes against a stable external ID so we update/replace thoughts in place rather than spawning duplicates. The sync worker runs on the Mac mini and polls the Vercel API for pending sync work.

- **Live (no debounce):** `syncRecipe(recipe)` on save — one thought per recipe.
- **Debounced live (~5 min coalesce):** Inventory and meal-plan mutations set a per-resource dirty flag in the DB. The worker claims dirty resources whose debounce window has elapsed and writes a fresh snapshot — one thought per inventory snapshot, one thought per current-week meal plan.
- **Daily roll-up:** Cook events flush once a day as a single thought summarizing yesterday.

Within a single request the writes are already one DB transaction → one dirty-flag update. The debounce coalesces bursts across multiple requests, so OpenBrain sees one snapshot per ~5-minute activity window — not N diffs.

## Playwright worker (`apps/scraper`)

- Runs on the home Mac mini (residential IP, always on).
- Pulls jobs from the API over an authenticated channel (signed requests).
- Per-store adapters live in `apps/scraper/src/stores/{newworld,paknsave,woolworths}.ts`.
- Sessions persisted as encrypted cookie blobs in `supermarket_credentials` (AES-256-GCM, key on the mini only). First login per store is two-step: a headed `bootstrap:newworld` runs on the user's laptop and writes a plaintext `storageState`; the user copies it to the mini, where `bootstrap:ingest` encrypts and POSTs. Subsequent runs are headless and decrypt on the mini.
- Job model: `scraper_jobs` (pending → in_progress → done | failed) with type-specific payloads. Two types in slice 1: `import_past_orders` (one-shot per store) and `compare_prices` (per shopping list).
- Per-item price snapshots in `shopping_list_prices` (one row per (item, store), upserted on each comparison).
- Read-only V3, build-to-cart V4. Never places orders.

## Frontend conventions (kept from starter)

- React 19 + Vite + React Router.
- TanStack Query for server state. Zustand for purely local UI state.
- CSS Modules / plain CSS, co-located with components.
- Inter font; dark theme defaults inherited from the starter (`#0f0f1a`, `#e2e8f0`, `#6366f1`).
- Vitest + React Testing Library for components; Playwright for app-level E2E (separate from the scraper Playwright).
- Storybook for the component library.

## Hosting & ops

- **Frontend + API:** Vercel (`apps/web` and `apps/server`).
- **DB + storage:** Supabase free tier — Postgres for domain data, Storage for recipe / inventory photos. Rows hold storage paths; URLs are signed on read.
- **Background workers:** `apps/scraper` and the OpenBrain sync worker on the home Mac mini, supervised by `launchd`. Both poll the Vercel API outbound for pending jobs — no inbound port is exposed at home.
- **Worker auth:** Mac mini holds a long-lived shared secret used to sign job-queue requests (HMAC).
- **Secrets:**
  - Vercel: OAuth client ID/secret, Supabase anon/service keys, HMAC key for worker auth.
  - Mac mini: HMAC key, OpenBrain API token, encryption key for supermarket session blobs.

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