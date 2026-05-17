# Phase 4 — Build-to-cart (New World) — Design

**Status:** Approved, ready for implementation plan. Revised 2026-05-18: candidate / chosen-sku columns moved to `shopping_list_prices` (already per-(item, store)); migration renumbered to 0011.
**Phase:** 4 (per [PLAN.md](../../../PLAN.md)).
**Scope:** New World only. Pak'nSave and Woolworths adapters stay on today's single-best matcher (deferred per D21).
**Constraint:** [D3](../../../DECISIONS.md#d3--supermarket-integration-ceiling-build-to-cart) — the app adds items to cart; the user always clicks "place order".

## Goal

Take the user's eat-thing shopping list and populate their New World trolley with the right products, with the user confirming any ambiguous matches before send.

The user model:

| State | When | Behaviour |
|---|---|---|
| **Sole** | Search returns one viable candidate | Auto-selected, no badge needed |
| **Preferred** | Preferred-brand candidate is the winner | Auto-selected; alternatives accessible if any are on special |
| **Manual** | Multiple plausible candidates, no preferred-brand winner | Nothing selected; user must pick before send |

"Viable" means a pack big enough to cover the recipe's required quantity (possibly via a `qty > 1` multiple). Ranking is by **per-100g / per-100ml unit price** ascending, not total price. Specials are decoration, not a ranking signal.

## Architecture

Two scraper jobs in sequence, separated by a user review step. No new tables; two columns added to `shopping_list_items`, one new `JobType`.

```
┌──────────────────┐    ┌────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ ShoppingListPage │ ──▶│ compare_prices │ ──▶│ Review on        │ ──▶│ add_to_cart     │
│ "Find products"  │    │ (top-N)        │    │ ShoppingListPage │    │ (diff + write)  │
└──────────────────┘    └────────────────┘    └──────────────────┘    └─────────────────┘
                                │                       │                       │
                                ▼                       ▼                       ▼
                       candidates JSONB         chosen_sku per item        result JSON
                       on shopping_list_items   (user's pick)              + reconcile view
```

**Why two explicit steps (not one button or eager matching):**

- State machine stays trivial — two job rows per shop, each `pending → in_progress → done | failed`.
- Re-runnable per step — if matches are good but cart-add fails, only re-run cart-add.
- "Find products before shopping" is a natural moment the user already pauses for.
- A one-button UX (collapsing the two steps) can be built later on top of the same primitives without schema or scraper change.

## Data model

### `shopping_list_prices` — migration `0011`

Today's `shopping_list_prices` table is already per-(item, store) with `sku`, `name`, `price`, `inStock`, `matched`. Two columns added:

```ts
candidates: jsonb('candidates')           // ProductCandidate[] | null
chosenSku: text('chosen_sku')             // user's pick (or auto-resolved); null until manual pick made
```

When `compare_prices` completes:

- `candidates` is populated with the top-N `ProductCandidate[]` from `rankCandidates`.
- `chosenSku` is set to the auto-resolved candidate for `sole` / `preferred` items; left null for `manual` items.
- The legacy `sku` / `name` / `price` / `inStock` columns continue to mirror the **chosen** candidate (or the top-1 if no chosen_sku) so today's price column keeps rendering without churn.

When the user picks a manual candidate, `chosenSku` is updated and the mirror columns are re-synced.

### `ProductCandidate` — shared type in `packages/shared`

```ts
type Unit = 'g' | 'ml' | 'count';

interface ProductCandidate {
  sku: string;
  name: string;
  brand: string | null;
  packSize: { qty: number; unit: Unit } | null;     // null → couldn't parse → drops to manual fallback
  price: number;                                    // total pack price NZD
  unitPrice: { value: number; per: Unit } | null;   // normalised; null → couldn't parse
  inStock: boolean;
  onSpecial: boolean;
  cartQty: number;                                  // multiplier from sufficient-pack filter; 1 unless need-more-than-one-pack
  resolution: 'sole' | 'preferred' | 'manual';
}
```

`chosenSku` is set automatically for `sole` and `preferred` items when `compare_prices` completes. `manual` items leave it null until the user picks.

### New `JobType`: `'add_to_cart'`

**Payload:**

```ts
{
  shoppingListId: string;
  items: Array<{ shoppingListItemId: string; sku: string; qty: number }>;
}
```

**Result on success:**

```ts
{
  perItem: Array<{
    shoppingListItemId: string;
    sku: string;
    requestedQty: number;
    action: 'added' | 'already_in_cart' | 'qty_increased' | 'failed';
    failureReason?: 'out_of_stock' | 'product_unavailable' | 'qty_rejected' | 'session_expired' | string;
  }>;
  cartTotalNzd: number;
  trolleyUrl: string;   // https://www.newworld.co.nz/shop/trolley
}
```

This shape is what the reconcile view consumes.

## Matcher changes

All in `apps/scraper`. Two files.

### `apps/scraper/src/stores/newworld.ts` — parser additions

`parseSearchResults` today extracts `{sku, name, brand, price, inStock}`. It additionally captures:

- **`packSize`** — from the product title. Regex `(\d+(\.\d+)?)\s*(kg|g|ml|l|pack|ea)` with normalisation to `{qty, unit: 'g'|'ml'|'count'}`. Parse failure → `null` (no silent guesses).
- **`unitPrice`** — NZ law requires "$X.XX / 100g" or "$X.XX / L" on every product card; selector discovered during smoke (likely a sibling of `price-dollars`). Normalised internally to per-`g` / per-`ml` / per-`count` for cross-pack comparison.
- **`onSpecial`** — boolean from price-strikethrough or "Special" badge selector.

Null on any of these → item drops to the manual-fallback pile (can't verify pack is sufficient → can't auto-pick).

A new `parseTrolley(html)` helper extracts current cart `{sku, qty}` lines (used by the cart-write diff).

### `apps/scraper/src/stores/match.ts` — `rankCandidates` rewrite

Replaces today's `pickMatch` (which returns one winner) with:

```ts
function rankCandidates(args: {
  item: {
    name: string;
    canonicalFoodId: string | null;
    requiredQty: number;
    requiredUnit: Unit;
  };
  candidates: ParsedSearchResult[];
  preferredBrandsByCanonicalFood: Record<string, Set<string>>;
  topN: number;     // default 5
}): ProductCandidate[];
```

Algorithm:

1. **Filter to sufficient packs.** Keep candidates where `packSize.qty * multiplier >= requiredQty` for some integer `multiplier ≥ 1`. Record the multiplier — it becomes the `qty` we send to cart. Null-packSize candidates go to a manual-fallback pile.
2. **Rank by normalised unit price ascending.** All unit prices are normalised to per-`g` / per-`ml` / per-`count` before compare so "per kg" sorts cleanly against "per 100g".
3. **Decide resolution:**
   - 1 candidate survives filtering → `sole`
   - Preferred-brand candidate is in the top 3 → `preferred` (alternatives are kept in the candidates list so the UI can show "X has the same brand on special")
   - Multiple plausible, no preferred-brand winner → `manual` (no auto-pick)
4. **Return top-N** (default 5) including the manual-fallback pile at the end, each with its `resolution`.

`requiredQty` / `requiredUnit` come from `shopping_list_items.qty` + `unit` already on the row. For `count` items (e.g. "2 onions"), the sufficient-pack filter is trivially true for any pack.

`match.test.ts` covers each resolution branch, multiplier math (need 3 kg / biggest pack is 1.5 kg → qty 2), null-packSize fallback, unit-price normalisation across `g`/`kg`/`100g`/`l`/`ml`.

## Cart-write flow (`add_to_cart`)

New method on the New World adapter — first time the scraper mutates state on the user's NW account.

**Flow:**

1. **Read existing trolley** — navigate to `https://www.newworld.co.nz/shop/trolley`, parse with `parseTrolley`. Logged-out detection → `{ ok: false, error: 'session_expired' }`; slice-2 hardening surfaces the re-bootstrap prompt.
2. **Diff each requested `{sku, qty}`** against the live trolley:
   - sku absent → `add`
   - sku present, qty < requested → `bump`
   - sku present, qty ≥ requested → `skip`
3. **Apply via product detail page**, not search results. Reason: search-results "Add" buttons set qty=1 with no easy way to set higher. Product detail pages have a qty stepper + "Add to trolley" button.
   - `page.goto('https://www.newworld.co.nz/shop/product/' + sku)`
   - Set qty by typing into the qty input (not clicking + N times)
   - Click "Add to trolley"
   - Wait for the trolley-count badge to update (deterministic confirmation, ~3s timeout)
   - Selectors discovered during smoke; abstracted behind named helpers (`qtyInput`, `addToTrolleyBtn`, `trolleyCountBadge`).
4. **Per-action result** appended to `result.perItem`. A single item failing (out of stock, qty rejected, 404'd product) does **not** abort the whole job — log and continue. Whole-job abort only on session expiry or browser crash.
5. **Read trolley back** — re-parse `/shop/trolley` for the final state, capture `cartTotalNzd`. NW is the source of truth for what landed.

**Idempotency.** Step 2 diffs against the live trolley before writing → user can hit "Send to cart" twice without doubling up; if `launchd` restarts the worker mid-job, the next claim re-reads and continues from current state.

**Throttling.** ~0.5–1s between product-page loads. Headless on Mac mini, residential IP per D9.

**Audit.** Every action and its outcome lives in `scraper_jobs.result.perItem`. Inspectable via SQL or the reconcile view. No separate audit table.

`newworld.test.ts` gets fixtures for trolley HTML, product-detail HTML, and a unit test for the diff logic.

## Server changes

`apps/server/src/routes/shopping-lists.ts`:

- Existing `POST /api/shopping-lists/:id/refresh-prices` keeps its current shape (enqueue `compare_prices`); behaviour changes so the job result is the new top-N candidate output and the completion handler writes `candidates` + auto-resolved `chosenSku` onto each `shopping_list_prices` row.
- Existing `GET /api/shopping-lists/:id/prices` response is extended to include `candidates` + `chosenSku` per row.
- `PATCH /api/shopping-lists/items/:id/chosen-sku` — new. Sets `chosenSku` on the relevant `shopping_list_prices` row. Server validates the value is one of the stored `candidates` (no arbitrary SKUs) and re-syncs the legacy mirror columns.
- `POST /api/shopping-lists/:id/send-to-cart` — new. Enqueues `add_to_cart`. Body is empty; server reads each `shopping_list_prices` row's `chosenSku` and looks up the matching candidate's `cartQty` from `candidates` to build the job payload. Items with null `chosenSku` are skipped with a note in the response.
- `GET /api/shopping-lists/:id/cart-result` — new. Returns the most recent completed `add_to_cart` job's result JSON for this list, for the reconcile view.

`apps/server/src/routes/scraper.ts` (generic job lifecycle) — adds `'add_to_cart'` to the allow-list. The completion handler mirrors `result.perItem` into a `cart_action` column on `shopping_list_items` (so the list can show small badges later if we want; not required for v1).

## Web changes

`apps/web/src/pages/ShoppingListPage/`:

- Existing **"Compare prices"** button renamed **"Find products"**. Same enqueue, item-level spinner while running.
- Each list row gains a **product strip** under the name: thumb of the chosen candidate, brand, pack size, unit price, special badge. Right-side **state badge**: `Sole match` / `Preferred` / `Pick one`.
- **"Pick one" rows are expandable** — taps reveal the top-N candidates as a small tappable list. Tapping a candidate calls `PATCH .../chosen-sku`; the row settles to a `Picked` badge.
- New **"Send to cart"** button next to "Find products". Disabled until at least one item has a `chosen_sku` **and** no `manual` items remain unpicked. Trying anyway → toast "X items still need a pick".
- **Reconcile view** — modal opened automatically when `add_to_cart` completes (also accessible later via a "View last cart" link). Lists each `perItem` row with its action, with failure reasons inline. Footer shows `cartTotalNzd` and **"Open New World trolley"** (target=`_blank` to `result.trolleyUrl`).

`apps/web/src/hooks/useShoppingList.ts` gets: `useFindProducts`, `useChooseSku`, `useSendToCart`, `useCartResult`. Standard TanStack Query patterns.

**Mobile.** All of this lives on `ShoppingListPage`, already responsive. The manual-pick expand is a vertical list of tappable rows.

## Error handling

| Failure | Behaviour |
|---|---|
| Session expired | `{ ok: false, error: 'session_expired' }`. UI surfaces "New World session expired — re-run `pnpm bootstrap:newworld` on the Mac mini" with help link. |
| Product 404 / pulled from catalogue | `perItem.action = 'failed'`, `failureReason = 'product_unavailable'`. Other items continue. |
| Out of stock at write time | `failed` + `out_of_stock`. |
| Qty input rejects requested number | `failed` + `qty_rejected:<max>`. User can fix in NW. |
| Selector miss (DOM changed) | Whole job fails with `selector:<which>`. Treated like the existing Phase 3 smoke breakages: fix selectors, re-run. |
| Browser crash / worker restart | `scraper_jobs.status` returns to `pending` via existing claim-timeout. Next claim re-reads trolley and diffs — idempotent. |

No new retry policy; the slice-2 hardening retry/backoff covers transient failures.

## Testing

Required before declaring done, per CLAUDE.md. From repo root: `pnpm test` and `pnpm test:e2e` must pass.

**Unit (Vitest):**

- `apps/scraper/src/stores/newworld.test.ts`: trolley HTML fixtures, product-detail HTML, pack-size parser cases, onSpecial detection, trolley-diff logic.
- `apps/scraper/src/stores/match.test.ts`: top-N ranking, sole / preferred / manual branches, pack-size filtering, multiplier math, null-packSize fallback, unit-price normalisation across `g`/`kg`/`100g`/`l`/`ml`.
- `apps/server/src/routes/shopping-lists.test.ts`: chosen-sku validation against stored candidates, send-to-cart skip for null chosen_sku, cart-result fetch shape.
- `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`: badge rendering per resolution, manual-pick expand + tap → `useChooseSku`, send button disabled state, reconcile modal opens on job completion.

**E2E (Playwright app-level):** extend the existing shopping-list test — load list → "Find products" (job mocked) → assert badges render → pick a manual item → "Send to cart" (job mocked) → assert reconcile modal + trolley link.

**Smoke against real NW:** extend `apps/scraper/src/smoke/newworld.ts` with a `cart` mode that runs a single tiny non-perishable item end-to-end against the live site. Idempotent (next run is a no-op via the diff). Manual trigger; not in CI.

## Rollout

Single-household app — no flag. Ship once tests are green. Implementation order:

1. Schema migration 0011 + shared `ProductCandidate` type
2. Parser additions (packSize, unitPrice, onSpecial) + their unit tests
3. `rankCandidates` rewrite + tests
4. Wire `compare_prices` completion to write `candidates` + `chosen_sku` to DB
5. UI: badges, manual-pick expand, "Pick one" wiring
6. Trolley parse + diff logic + tests
7. `add_to_cart` adapter method + tests
8. Server route + job lifecycle plumbing
9. UI: send-to-cart button, reconcile modal, trolley link
10. Smoke against live NW
11. Update PLAN.md (move Phase 4 items to Done) + new DECISIONS.md entry for build-to-cart implementation

## Out of scope (explicit)

- Pak'nSave / Woolworths build-to-cart (deferred per D21; their adapters keep single-best matcher).
- Auto-placing orders (per [D3](../../../DECISIONS.md#d3--supermarket-integration-ceiling-build-to-cart)).
- One-button "find + send" UX (Approach B from brainstorming) — same primitives, future UI layer.
- Eager matching on every shopping-list edit (Approach C) — defer until usage warrants the scraper load.
- Per-item retry UI in the reconcile view — failures are visible; user re-runs the whole job if needed.
- Per-store cart badges on each shopping list row showing "in cart" — future polish on top of the `cart_action` mirror column.
