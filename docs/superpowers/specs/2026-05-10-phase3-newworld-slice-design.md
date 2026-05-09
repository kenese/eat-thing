# Phase 3 Slice 1 — New World vertical

**Date:** 2026-05-10
**Status:** Approved (defaults flow); proceeding directly to plan + implementation
**Predecessor decisions:** [D3](../../../DECISIONS.md#d3--supermarket-integration-ceiling-build-to-cart), [D9](../../../DECISIONS.md#d9--playwright-worker-runs-on-the-home-mac-mini), [D14](../../../DECISIONS.md#d14--mac-mini-hosts-all-background-workers), [D16](../../../DECISIONS.md#d16--hosting-split-vercel-for-http-mac-mini-for-workers)

## Goal

Ship an end-to-end New-World-only flow so the existing `ShoppingListPage` can show current price + availability per item, sourced from a residential-IP Playwright scraper on the home Mac mini. Single-store on purpose: this slice answers the hardest design questions (session bootstrap, encryption boundary, catalog matching) against one real adapter before generalising.

## Scope

### In
- AES-256-GCM credential encryption with key on the Mac mini only.
- Headed first-run login bootstrap (run on user's laptop, transferred to mini).
- Past-orders mining → preferred-brand map (`supermarket_products.preferred = true`).
- Hybrid catalog matching: cache + live search.
- Server endpoints to enqueue/claim/report scraper jobs, aligned with the existing `WORKER_HMAC_KEY` scheme.
- Inline price + availability column on the existing `ShoppingListPage`, plus a "Refresh prices" trigger.
- Tests: encryption round-trip, adapter parsing against HAR fixtures, server route tests, frontend states.

### Out (defer)
- Pak'nSave and Woolworths adapters (slice 2).
- Multi-store recommendation UI / split shop (needs ≥2 adapters).
- `launchd` plist for the scraper (run via `pnpm dev:scraper` for now).
- Build-to-cart (Phase 4).

## Architecture

### Encryption boundary

- Mac mini holds `SUPERMARKET_ENC_KEY` (32 bytes, base64 in env). Server **never** holds the key.
- AES-256-GCM via `node:crypto`. Ciphertext format: `iv (12 B) || authTag (16 B) || ciphertext`, base64-encoded for storage.
- Plaintext is a Playwright `storageState` JSON (cookies + localStorage), the format Playwright produces from `context.storageState()`.
- Bootstrap is split: a **login** script runs headed on the user's laptop and writes plaintext `storageState` to disk; the user transfers the file to the mini; an **ingest** script on the mini encrypts and POSTs. The encryption key never leaves the mini. The scraper worker decrypts on read.
- Server stores opaque base64 in `supermarket_credentials.encrypted_session_blob`; route handlers do not parse it.

This resolves the docs conflict between PLAN.md ("server only") and ARCHITECTURE.md ("Mac mini only") in favour of mini-only. ARCHITECTURE.md will be updated as part of the work, with a corresponding entry in DECISIONS.md.

### HMAC scheme alignment

Existing OpenBrain worker uses: `X-Worker-Timestamp` (seconds) + `X-Worker-Signature` headers, payload = `METHOD\nPATH\nTIMESTAMP\nBODY` (raw body, not hashed), env var `WORKER_HMAC_KEY`, server-side replay window 300 s. The Phase-0 scraper SDK stub diverges (Authorization header, hashed body, ms timestamp, different env var). The scraper SDK is refactored to match the OpenBrain scheme. One shared signer, one shared env var, one server middleware (`withWorkerAuth`).

### Schema additions

One Drizzle migration. No destructive changes.

**`scraper_jobs`** — explicit job queue (scraper jobs carry payloads, unlike the dirty-flag-only OpenBrain sync):
| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `household_id` | uuid not null fk → households.id | |
| `store` | store enum | one of `new_world`, `paknsave`, `woolworths` |
| `type` | text not null | `import_past_orders` \| `compare_prices` |
| `payload` | jsonb | type-specific (e.g. `{ shoppingListId }`) |
| `status` | text not null default `'pending'` | `pending` \| `in_progress` \| `done` \| `failed` |
| `result` | jsonb | populated on success |
| `error` | text | populated on failure |
| `attempts` | int not null default 0 | for backoff |
| `created_at`, `claimed_at`, `completed_at` | timestamps | |

**`shopping_list_prices`** — per-item price snapshot per store:
| column | type | notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `shopping_list_item_id` | uuid not null fk → shopping_list_items.id (cascade) | |
| `store` | store enum | |
| `sku` | text | nullable when no match |
| `name` | text | display name from store |
| `price` | numeric(10,2) | nullable when out of stock or no match |
| `in_stock` | boolean not null default true | |
| `matched` | boolean not null default true | false = no plausible match |
| `checked_at` | timestamp not null default now() | |
| unique | (shopping_list_item_id, store) | one row per (item, store) — overwritten on refresh |

**`supermarket_products`** — no schema change. Slice uses existing `preferred` boolean and `last_seen_*` fields.

### Server routes

All scraper routes use `withWorkerAuth` (HMAC). User-facing routes use the existing `requireSession` + `withHousehold` middleware.

**Worker-auth (Mac mini):**
- `POST /api/scraper/session` — body `{ householdId, store, encryptedBlob }`, upsert into `supermarket_credentials`. Returns `{ ok: true }`.
- `GET /api/scraper/session/:householdId/:store` — returns `{ encryptedBlob, lastLoginAt }` or 404.
- `GET /api/scraper/jobs/pending` — returns `{ jobs: [...] }` for status = `pending`. Worker calls `claim` next.
- `POST /api/scraper/jobs/:id/claim` — sets status = `in_progress`, `claimed_at = now()`. Returns `{ ok: true }`.
- `POST /api/scraper/jobs/:id/result` — body `{ ok, data?, error? }`. On success: writes `shopping_list_prices` rows when `type = compare_prices`, upserts `supermarket_products` rows with `preferred = true` when `type = import_past_orders`. Sets status `done` or `failed`.

**User-auth (web):**
- `POST /api/shopping-lists/:id/refresh-prices` — enqueues a `compare_prices` job for the current household scoped to this list. Returns `{ jobId }`.
- `GET /api/shopping-lists/:id/prices` — returns latest `shopping_list_prices` rows joined to items, plus the most-recent job's status. Returns `{ prices: [...], job: { id, status, error? } | null }`.
- `POST /api/scraper/import-past-orders` — body `{ store }`. Enqueues an `import_past_orders` job. Returns `{ jobId }`.

### Scraper code

Files added/changed under `apps/scraper/src/`:

- **`encryption.ts`** — `encrypt(plaintext, key) -> base64`, `decrypt(base64, key) -> plaintext`, AES-256-GCM. Throws on auth-tag mismatch.
- **`session.ts`** — `loadStorageState(householdId, store) -> StorageState | null`. Calls server, decrypts, parses JSON.
- **`bootstrap/newworld-login.ts`** — `pnpm bootstrap:newworld`: launches headed Playwright at `https://www.newworld.co.nz`, waits for the user to complete login (detects via cookie or URL change), saves `storageState()` to `~/.eat-thing/newworld-storage.json`. Prints the next-step command.
- **`bootstrap/ingest.ts`** — `pnpm bootstrap:ingest --store new_world --file <path>`: reads file, encrypts with `SUPERMARKET_ENC_KEY`, POSTs to `/api/scraper/session` via signed worker fetch.
- **`worker-sdk/sign.ts`** — refactored to match OpenBrain HMAC scheme (`X-Worker-*` headers, raw body, seconds timestamp). Drop hashed-body variant.
- **`worker-sdk/client.ts`** — extend with `fetchSession`, `postSession`, `claimJob`. Existing `fetchPendingJobs` / `reportJobResult` keep their names but adapt to `/api/scraper/jobs/*` shape.
- **`stores/newworld.ts`** — replaces stub:
  - `searchProduct(page, query)` — drives `/shop/search?q=…`, parses top N results into `{ sku, name, brand, price, inStock }[]`.
  - `scrapePastOrders(page)` — walks `/shop/account/orders` history, returns `{ sku, name, brand, qty, lastOrderedAt }[]`.
  - `handle(job, browser)` — opens a context with the loaded storage state; dispatches on `job.type`. Detects logged-out (returns `error: 'session_expired'`).
- **`stores/match.ts`** — given a shopping-list item + a household's preferred map + a search-result list, picks the best match. Strategy: prefer rows with `preferred = true` for the canonical food → exact alias hit on name → contains → reject if no candidate above a similarity threshold. LLM tiebreak deferred unless empirical results need it.

### Web UI

- `ShoppingListPage.tsx`:
  - "Refresh prices" button next to "Generate for this week" (disabled when no list).
  - Per-`ItemRow`: a third column showing one of `loading…` / `$X.XX ✓` / `out of stock` / `no match` / nothing-yet.
- New hook `usePricesForList(listId)` — TanStack Query; polls every 5 s while job status is `pending`/`in_progress`, otherwise fetches once on mount.

### Day-to-day operator flow

1. **One-time setup (user, on laptop):** `pnpm --filter @eat/scraper bootstrap:newworld`. Browser opens, user logs in to New World, script saves `~/.eat-thing/newworld-storage.json`, prints the SCP command.
2. **Transfer to mini (user):** `scp ~/.eat-thing/newworld-storage.json mac-mini:~/.eat-thing/`.
3. **Ingest (mini):** `pnpm --filter @eat/scraper bootstrap:ingest --store new_world --file ~/.eat-thing/newworld-storage.json`. Encrypts, POSTs to server. Done.
4. **Past-orders (one-time):** user clicks "Import past orders" in app (or hits route). Mini's worker picks it up next poll, scrapes order history, populates preferred brands.
5. **Daily use:** user generates a shopping list → clicks "Refresh prices" → mini's worker runs `compare_prices` → UI polls, fills in price column.

### Tests

**Unit (vitest):**
- `apps/scraper/src/encryption.test.ts` — round-trip; tampered blob → throw.
- `apps/scraper/src/stores/newworld.test.ts` — parse fixtures: search result list, past-orders page, logged-out detection.
- `apps/scraper/src/stores/match.test.ts` — preferred brand wins; no-match returns `matched: false`; cache-fresh skips live search.
- `apps/server/src/routes/scraper.test.ts` — HMAC verify, session round-trip, job lifecycle (pending → claim → result), past-orders result populates `supermarket_products`, compare result populates `shopping_list_prices`.
- `apps/server/src/routes/shopping-lists.test.ts` — extend with `refresh-prices` enqueues a job and `GET /prices` returns rows.
- `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx` — refresh button enqueues; price column states render correctly.

**Smoke (manual, not in default `pnpm test`):**
- `pnpm --filter @eat/scraper smoke:newworld` — reads stored session, performs one search against the live site, asserts ≥1 product returned. Run after bootstrap to confirm end-to-end.

**Fixtures:**
- HAR / HTML snapshots stored under `apps/scraper/test/fixtures/newworld/`. Refresh procedure documented in a short README in that folder.

### Migration

One Drizzle migration: `add_scraper_jobs_and_shopping_list_prices`. Both tables additive. `pnpm --filter @eat/server db:migrate` is non-destructive.

### Documentation updates

- `PLAN.md` — mark slice 1 items in progress as we go; move to Done with date when complete.
- `ARCHITECTURE.md` — fix the encryption-key location to "Mac mini only"; expand the Playwright worker section with the bootstrap flow + job model.
- `DECISIONS.md` — new entry **D17 — Supermarket session encryption key lives on the Mac mini only**, citing this slice and superseding any conflicting wording in ARCHITECTURE.md.

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Bot detection blocks vanilla Playwright | First iteration uses real session cookies + realistic UA/viewport. If blocked, layer in `playwright-extra` + stealth — kept out of slice 1 to avoid premature complexity. |
| HAR fixtures rot as New World ships UI changes | Smoke command catches drift; refresh procedure documented in fixtures README. |
| Cold-start matching is noisy (no preferred brands yet) | `import_past_orders` is a one-shot the user runs once after bootstrap; subsequent matches use the resulting preferred-brand map. |
| User session expires silently | Adapter detects logged-out (no `userId` cookie / login redirect on a known-protected page) and returns `error: 'session_expired'` so the UI can prompt for re-login. |
| Encryption key loss = locked sessions | Acceptable: rebooting the bootstrap flow takes ~2 minutes per store. No backup of the key needed. |

## Stop point (human gate)

Two steps require a human at a browser:
1. **Headed login** — script will be ready; user runs `pnpm bootstrap:newworld` when back.
2. **Smoke test** — user runs `pnpm smoke:newworld` after ingest to confirm end-to-end works against the live site.

Everything up to those two steps is autonomous: spec, plan, schema, server routes, scraper code, fixtures, tests, commits.
