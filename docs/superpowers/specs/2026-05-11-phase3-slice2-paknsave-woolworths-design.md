# Phase 3 Slice 2 — Pak'nSave + Woolworths adapters

**Date:** 2026-05-11
**Status:** approved, ready for implementation plan
**Slice scope:** two store adapters following the slice-1 pattern. No UI, no robustness layer, no launchd. Those land in chunk 3 / slice 3.

## Why this slice

Slice 1 landed New World as a vertical (encrypted sessions, jobs lifecycle, parser, matcher, single-store price column on the shopping list). Multi-store value — cheapest / convenient / split shop — only becomes real once the other two NZ stores can return prices. This slice adds the data-collection side for Pak'nSave and Woolworths. Display of multi-store data remains deferred until slice 3.

## Decisions locked during brainstorming

| # | Decision | Why |
|---|----------|-----|
| 1 | Both adapters together (not one then the other) | The pattern is set; the marginal cost of the second is small once the first is wired. Two stores in one slice keeps round-trip overhead down. |
| 2 | Separate Pak'nSave session from New World | Even though both are Foodstuffs, modelling them independently keeps adapters decoupled. Cheap to merge later if it turns out the cookies are interchangeable; expensive to split if we coupled them. |
| 3 | Each adapter gets its own `import_past_orders` job | Symmetric with NW. If the user has never shopped online at one of these stores, the import returns empty rows and the adapter still works on name-match. |
| 4 | Smoke-only run path | `refresh-prices` keeps enqueueing only New World. Adapters are exercised via CLI smoke commands. End-to-end app integration waits for the multi-store UI in slice 3. |
| 5 | Approach A — clone-and-tweak | Each adapter is a self-contained ~130-line file. No shared-orchestration refactor. Honors the same "isolation over DRY" instinct that drove decision 2. Third store will tell us whether B was worth doing. |

## Architecture

### Files to add

```
apps/scraper/src/stores/
  paknsave.ts                   ← clone of newworld.ts, ~130 lines
  paknsave.test.ts              ← clone of newworld.test.ts, synthetic HTML inline
  woolworths.ts                 ← same shape
  woolworths.test.ts            ← same shape
apps/scraper/src/bootstrap/
  paknsave.ts                   ← headed login → ~/.eat-thing/paknsave-storage.json
  woolworths.ts                 ← headed login → ~/.eat-thing/woolworths-storage.json
apps/scraper/src/smoke/
  paknsave.ts                   ← CLI: argv → JSON match
  woolworths.ts                 ← CLI: argv → JSON match
apps/scraper/package.json       ← add scripts: bootstrap:paknsave, bootstrap:woolworths,
                                  smoke:paknsave, smoke:woolworths
```

### Files to remove (replace stubs)

- `apps/scraper/src/stores/paknsave.ts` — currently 9-line "not implemented" stub
- `apps/scraper/src/stores/woolworths.ts` — same

### Files unchanged

- `apps/scraper/src/index.ts` — dispatch table already wires both adapters
- `apps/scraper/src/stores/base.ts`, `match.ts` — adapter contract and matching helper unchanged
- `apps/server/src/routes/shopping-lists.ts` — `refresh-prices` keeps enqueueing only New World (slice 3 will fan out)
- `packages/shared/src/index.ts` — `Store` type already includes `'paknsave' | 'woolworths'`
- `apps/server/src/db/schema/enums.ts` — `storeEnum` already includes both
- `apps/web/src/pages/ShoppingListPage/` — no UI changes this slice

## Per-adapter contract

Each adapter file exports:

```typescript
export interface ParsedSearchResult { sku, name, brand, price, inStock }
export interface ParsedPastOrderProduct { sku, name, brand, timesPurchased }

export function parseSearchResults(html: string): ParsedSearchResult[]
export function parsePastOrders(html: string): ParsedPastOrderProduct[]
export function isLoggedOutPage(html: string): boolean

const SEARCH_URL = (q: string) => `https://www.<store>.co.nz/...?q=${encodeURIComponent(q)}`
const ORDERS_URL = 'https://www.<store>.co.nz/account/orders'

export const <store>Adapter: StoreAdapter = {
  async handle(job, browser): Promise<JobResult> {
    // 1. loadStorageState(job.householdId, '<store>') → no_session if absent
    // 2. browser.newContext({ storageState }) + page
    // 3. switch on job.type: 'compare_prices' | 'import_past_orders' | unknown
    // 4. each branch: page.goto(URL), page.content(), isLoggedOutPage(html) → session_expired
    // 5. parse, pickMatch (compare) or pass through (orders)
    // 6. always context.close() in finally
  },
}
```

This is a structural copy of `apps/scraper/src/stores/newworld.ts:60-137`. The only differences per store are URLs and selectors.

### Selectors

Synthetic placeholders, same convention as slice 1:

| Store      | Search-card selector                                | Past-orders selector                            | Logged-out marker                              |
|------------|------------------------------------------------------|--------------------------------------------------|-------------------------------------------------|
| Pak'nSave  | `ul[data-testid="product-grid"] > li[data-product-id]` | `section[data-testid="past-orders"] li[data-product-id]` | `div[data-testid="login-required"]` |
| Woolworths | `ul[data-testid="product-grid"] > li[data-product-id]` | `section[data-testid="past-orders"] li[data-product-id]` | `div[data-testid="login-required"]` |

Real selectors get tuned at smoke time when the user runs `smoke:<store>` against the live site for the first time. This is the same gate that exists for New World.

## Tests

Each `<store>.test.ts` mirrors `newworld.test.ts` (4 tests):

1. `parseSearchResults` — synthetic HTML with three products, asserts shape + `inStock` parsing + missing-brand handling.
2. `parsePastOrders` — synthetic HTML with repeats of one SKU, asserts `timesPurchased` accumulation.
3. `isLoggedOutPage` — true for HTML containing the marker, false otherwise.
4. `handle({ type: 'compare_prices', ... })` end-to-end with mocked `Browser`/`Page` returning canned HTML — asserts the resulting `JobResult.data.items` shape and that `pickMatch` was used (preferred-brand bias verified by a real `match.test.ts`, no need to retest here).

Inline HTML strings, no external fixtures.

## Bootstrap commands

```bash
# On the user's laptop, headed:
pnpm --filter @eat/scraper bootstrap:paknsave
pnpm --filter @eat/scraper bootstrap:woolworths
```

Each opens Chromium pointed at the store's login page, waits for the user to complete login, then writes `storageState` to `~/.eat-thing/<store>-storage.json`. Identical structure to `bootstrap/newworld.ts:1-30`.

The user then runs the existing `bootstrap:ingest` command (no changes needed) to encrypt + POST the storage state to the server, just with a different `--store` and `--file` for each.

## Smoke commands

```bash
SMOKE_HOUSEHOLD_ID=<id> pnpm --filter @eat/scraper smoke:paknsave eggs
SMOKE_HOUSEHOLD_ID=<id> pnpm --filter @eat/scraper smoke:woolworths eggs
```

Each instantiates the right adapter, builds a synthetic `compare_prices` job for one item with the argv query string, runs `handle()` against a real Chromium, prints JSON result. No API hop, no DB write — just adapter exercise.

## Out of scope (explicit, deferred to later slices)

- Multi-store enqueueing in `refresh-prices` (slice 3)
- Multi-store recommendation UI (slice 3)
- Retry/backoff and connection-failure resilience (slice 3 robustness chunk)
- launchd plists for auto-start on Mac mini (slice 3 ops chunk)
- Foodstuffs shared-session optimization (decision 2: stay isolated)
- Real selector tuning — happens at user smoke time
- Per-store concurrency tuning — adapters run sequentially via existing worker loop

## Test surface this slice adds

- 8 new unit tests (4 per adapter)
- 0 new E2E
- All 163 existing unit tests stay green
- All 13 existing E2E stay green

## Verification plan

After implementation:
1. `pnpm --filter @eat/scraper test` — 8 new tests pass alongside the 42 existing
2. `pnpm test` from repo root — full suite green
3. `pnpm test:e2e` — full suite green
4. Operator handoff: same shape as slice 1, with two new bootstrap + ingest pairs and two new smoke commands

The user's manual smoke at slice end is the live-selector gate, identical in shape to slice 1.
