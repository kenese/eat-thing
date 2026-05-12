# Phase 3 slice 3 — Multi-store fan-out + comparison UI

Status: spec · 2026-05-12
Scope: `apps/server` + `apps/web` + `@eat/shared` types · no schema changes
Driver: PLAN.md Phase 3 slice 3, chunk 1 ("Multi-store recommendation UI: cheapest store, convenient store, optional split shop"). Brainstorm: 2026-05-12 with visual companion; user picked decision-once over split-shop, lean drawer over per-item table, and cheapest-by-default semantics.

---

## Goal

Replace the single-store price refresh flow on the shopping list page with a multi-store fan-out: refreshing prices enqueues one scraper job per connected store, all run in parallel, and the page surfaces the cheapest store by default with a slide-out drawer that lets the user compare across the connected stores and switch the displayed prices to a different store in one click.

## Non-goals

- No schema changes — the existing `shopping_list_prices` and `scraper_jobs` tables are already store-keyed.
- No persistence of a "primary store" preference (per-household or per-list). Switching the displayed store is purely a client-side state change; re-opening the list reverts to the default (cheapest).
- No split-shop UX ("buy item X at New World, item Y at Pak'nSave"). Decision-once mental model only.
- No in-app store-connection bootstrap flow — that's still operator-only via `pnpm --filter @eat/scraper bootstrap:<store>` on the laptop. The "connect {store}" affordance is a modal that displays the command, not a one-click connect.
- No auto-refresh prices on list generation — manual refresh only, same as today.
- No per-item cheapest-store hint on the list rows. The list row keeps a single price (current store's). The per-store breakdown lives only in the drawer.
- Settings page for managing connected stores — separate spec.

---

## 1. Mental model

**Decision-once:** the user looks at this week's list and wants to know which one store to shop at. The drawer answers "which store is cheapest for this list, and by how much?" and offers a single CTA to act on that answer.

**Current store** is whatever store's prices are currently being displayed in the sidebar tile + price column. On first load of a list (or after a price refresh), current = cheapest. Clicking "switch to {store}" in the drawer changes current to that store. Reloading the page or invalidating the prices query resets current back to cheapest.

**Connected vs unconnected:** "connected" means the household has a `supermarket_credentials` row for that store. Unconnected stores still appear in the drawer as inert tiles with a "connect {store} →" affordance, so the comparison feature is discoverable even before all three stores are wired up.

---

## 2. Backend

### 2.1 `POST /api/shopping-lists/:id/refresh-prices`

**Today:** inserts a single `scraper_jobs` row hardcoded to `store: 'new_world'`. Returns `{ jobId: string }`.

**Change:** enumerate the household's `supermarket_credentials` rows where `encryptedSessionBlob IS NOT NULL` (a credential with a captured session is required for the worker to do anything useful — a bootstrapped-but-not-yet-ingested credential row is skipped). For each remaining store, insert a `scraper_jobs` row of type `'compare_prices'` for that store, payload `{ shoppingListId: listId }`. All inserts go into a single transaction. Return:

```ts
{ jobs: { store: 'new_world' | 'paknsave' | 'woolworths', jobId: string }[] }
```

If the household has zero connected stores, return `200` with `{ jobs: [] }` (the UI handles this case by hiding the refresh button — see §3.4).

### 2.2 `GET /api/shopping-lists/:id/prices`

**Today:** returns `{ prices: [...], job: { id, status, error } | null }` where `job` is the most-recent `compare_prices` job for this list across any store.

**Change:** return `jobs` as an array — one entry per store with an active or recent `compare_prices` job for this list:

```ts
{
  prices: ShoppingListPrice[],  // all stores, no filter
  jobs: { id: string, store: Store, status: JobStatus, error: string | null }[]
}
```

Job aggregation: take the most-recent job per `store` from the household's `scraper_jobs` rows where `type = 'compare_prices'` and `payload.shoppingListId = :id`. Order doesn't matter for the response; the client groups by store.

`prices` continues to return ALL rows from `shopping_list_prices` for this list — no store filter. The client filters by current store when rendering rows.

### 2.3 Shared types (`@eat/shared`)

```ts
export type Store = 'new_world' | 'paknsave' | 'woolworths';
export type JobStatus = 'pending' | 'in_progress' | 'done' | 'error';

export interface RefreshPricesResponse {
  jobs: { store: Store, jobId: string }[];
}

export interface PricesForListResponse {
  prices: ShoppingListPrice[];
  jobs: { id: string, store: Store, status: JobStatus, error: string | null }[];
}
```

(Both shapes replace the current single-`job` form. The shared `ShoppingListPrice` type already carries `store`.)

### 2.4 Tests

Server unit tests for `shopping-lists.ts`:
- `POST /refresh-prices` with two connected stores → 2 jobs inserted, response shape correct, both reference the same `shoppingListId` in payload.
- `POST /refresh-prices` with zero connected stores → 200 with empty `jobs: []`, no rows inserted.
- `GET /prices` → returns one job entry per store that has run, even if some have failed.

No new E2E tests in this slice — the price refresh path needs real Playwright workers, which only run during operator smoke tests.

---

## 3. Frontend

### 3.1 Hooks

`useStoreSelection(listId, defaultStore)` — small custom hook (or inline `useState` inside `ShoppingListPage`):

- Holds `currentStore: Store | null`.
- On mount, initializes to `defaultStore` (the cheapest store, computed by the parent from prices).
- Exposes `setCurrentStore(store: Store)` for the drawer's switch CTA.
- Resets to default whenever `defaultStore` changes (new price refresh → cheapest may shift).

`usePricesForList(listId)` — keep existing shape; just update the response type to the new `PricesForListResponse`. The hook now exposes `data.jobs[]` instead of `data.job`.

`useRefreshPrices(listId)` — keep existing shape; update return type to `RefreshPricesResponse`.

### 3.2 Helpers (apps/web/src/lib/storeTotals.ts — new)

```ts
export interface StoreTotal {
  store: Store;
  total: number;          // sum of priced+inStock items
  pricedCount: number;
  unmatched: number;      // items with no priced row or not in stock
}

export function computeStoreTotals(
  prices: ShoppingListPrice[],
  items: ShoppingListItem[]
): StoreTotal[];

export function cheapestStore(totals: StoreTotal[]): Store | null;
```

Unit-tested. `cheapestStore` returns null when totals is empty.

### 3.3 ShoppingListPage rewiring

- Compute `storeTotals = computeStoreTotals(pricesData?.prices ?? [], list.items)` and `cheapest = cheapestStore(storeTotals)`.
- Pass `cheapest` as `defaultStore` to `useStoreSelection`.
- The sidebar tile (`sl-store`) now shows the **currentStore** label (NW/PS/WW) — derived from the selection hook, not from the first price row.
- The price column filters `prices` to `price.store === currentStore` when looking up the per-row price.
- The totals card uses the current store's total.

### 3.4 ComparisonDrawer component (apps/web/src/components/ComparisonDrawer.tsx — new)

Props:
```ts
{
  storeTotals: StoreTotal[];
  currentStore: Store | null;
  connectedStores: Store[];      // from refresh-prices response or supermarket_credentials API
  onSwitch: (store: Store) => void;
  onClose: () => void;
}
```

Visual treatment (locked from the visual brainstorm — lean drawer):
- Ink card (`var(--ink)` background, paper text).
- Eyebrow `COMPARE PRICES` in persimmon.
- Italic Lora title `Three stores.` (period in persimmon — uses existing `.dot` rule).
- Three store cards stacked vertically:
  - **Current store** (top): subtle border, no highlight. Eyebrow `CURRENT`. Total in italic Lora.
  - **Cheapest** (next, if not the same as current): persimmon-tinted background + persimmon border. Eyebrow `CHEAPEST · SAVE $X.XX` in fresh-green. Total in fresh-green.
  - **Other** stores: subtle border, eyebrow shows the delta (`+$2.81`).
  - **Unconnected** stores: greyed tile with eyebrow `NOT CONNECTED` and a text link `connect {store} →` that opens a `ConnectStoreModal` (§3.5).
- Single persimmon CTA at the bottom: `switch to {cheapest} →`. Disabled when `current === cheapest` (the drawer becomes informational rather than actionable; the CTA is replaced with mute text `you're already at the cheapest`).

Mounting: the drawer is a right-side sticky panel that slides over the existing sidebar. When open, it covers the totals card but the page header + list remain visible. Close on Escape, or by clicking the dedicated `×` close button in the drawer's top-right (no whole-document click-outside handler — too easy to dismiss accidentally while scrolling the list). Plain CSS transitions; no portal needed.

Trigger: a new `Compare prices` button immediately below the totals card in the sidebar. Hidden entirely when zero stores are connected (no useful comparison to make).

### 3.5 ConnectStoreModal component (apps/web/src/components/ConnectStoreModal.tsx — new)

Triggered by the "connect {store} →" link in the drawer. Modal contents:
- Title: `Connect {Store Name}.`
- Body: italic-Lora explainer — "The first-time login runs on your laptop with a real Chromium so you can type your store password. Copy these commands and run them in order."
- Three code blocks with copy-to-clipboard buttons:
  1. `pnpm --filter @eat/scraper bootstrap:{store}` (on the laptop)
  2. `scp ~/.eat/scraper-state-{store}.json mini.local:~/.eat/` (transfer the session)
  3. `pnpm --filter @eat/scraper bootstrap:ingest --store {store}` (on the mini)
- Footer: `When you're done, hit refresh prices again — the new store will appear.`

No actual interactivity beyond the copy-buttons. The modal exists to keep the user in flow without pretending we can do the operator work for them.

### 3.6 AgentStatusCard wiring

The existing `AgentStatusCard` reads a single agent state. With per-store jobs, derive the displayed state by aggregating across the current `jobs[]`:

- If **any** job has `status === 'pending'` or `'in_progress'`: card shows `running` with message `Checking prices at {N} stores.` (where N is the count of in-flight jobs).
- Else if **all** jobs have `status === 'error'`: card shows `failed` with message `Couldn't reach any store. Try refreshing again.`
- Else if **some** jobs have `status === 'error'` and some succeeded: card shows `failed` with message `{store} failed; other stores updated.` Use the first errored job for the message; if more than one failed, append `+{N-1} more.`
- Else: card shows `idle` with the existing italic-Lora boilerplate.

### 3.7 ShoppingListPage tests

Update `ShoppingListPage.test.tsx`:
- Assertions touching `pricesData.job` → adapt to `pricesData.jobs` array.
- New test: when prices contain rows for 3 stores with NW=$58, PnS=$53, WW=$61, the default sidebar tile shows PnS and the price column shows PnS prices.
- New test: clicking "Compare prices" opens the drawer; clicking "switch to New World" updates the sidebar tile to NW and the price column to NW.
- New test: when zero stores are connected (empty `jobs[]` from refresh-prices, no prices), the Compare prices button is not rendered.

New unit test `storeTotals.test.ts`:
- `computeStoreTotals` with mixed in-stock / not-matched prices.
- `cheapestStore` selects lowest total; ties broken by store key ascending.
- `cheapestStore` returns null when totals is empty.

New unit test `ConnectStoreModal.test.tsx`:
- Renders the three commands with the correct `{store}` interpolation.
- Copy-to-clipboard buttons fire (mock `navigator.clipboard.writeText`).

---

## 4. Data flow walkthrough

User has NW + PnS connected, WW unconnected. List has 14 items.

1. User clicks **Refresh prices**.
2. `POST /api/shopping-lists/:id/refresh-prices` enqueues 2 jobs (one for NW, one for PnS). Response: `{ jobs: [{ store: 'new_world', jobId: 'a' }, { store: 'paknsave', jobId: 'b' }] }`.
3. Web client polls `GET /api/shopping-lists/:id/prices` every 5s (existing behaviour).
4. As each worker writes rows to `shopping_list_prices`, the GET response starts including those rows. The `jobs` field also tracks the status of each.
5. When both jobs reach `done`:
   - `computeStoreTotals` returns `[{ store: 'paknsave', total: 53.40, ... }, { store: 'new_world', total: 58.29, ... }]`.
   - `cheapestStore = 'paknsave'`, so the sidebar tile flips to PS and the price column shows Pak'nSave prices.
6. User clicks **Compare prices**. The drawer slides over the sidebar.
7. Drawer renders:
   - Pak'nSave tile (current + cheapest — combined treatment, persimmon border, no CTA — already at cheapest).
   - New World tile with `+$4.89` delta.
   - Woolworths tile in greyed state with `connect Woolworths →` link.
8. User clicks `connect Woolworths →` → `ConnectStoreModal` opens with the three bootstrap commands.

---

## 5. Out-of-scope follow-ups (acknowledged, not built)

- **Settings page for credentials** — managing/removing/refreshing supermarket credentials in the UI.
- **Per-item cheapest-store hint** — small pill on each row showing which store has the best price for that one item. Lives behind a separate spec; would supersede the drawer-only model.
- **Split shop** — accepting two-store fulfilment ("buy 5 items at NW, 9 at PnS") with combined totals and a split-checkout flow.
- **Persisted "primary store" preference** — household-level default that survives across lists.
- **Auto-refresh on list generation** — triggering refresh-prices automatically when a new list is generated.
- **Robustness layer for scraper failures** — logged-out detection, retry/backoff. Chunk 3 of PLAN.md Phase 3 slice 3.
- **`launchd` plists for worker auto-start** — chunk 4 of PLAN.md Phase 3 slice 3.

---

## 6. PLAN.md insertion

Once shipped, mark slice 3 chunk 1 done in PLAN.md:

```
### Slice 3 — Multi-store UI + production hardening

- [x] Multi-store recommendation UI: cheapest store comparison drawer — _2026-05-12_
- [x] Multi-store `refresh-prices` enqueue (fan out per active session) — _2026-05-12_
- [ ] Robustness: detect logged-out state and prompt user; retry/backoff for transient failures
- [ ] `launchd` plists so both the scraper and the OpenBrain sync worker auto-start on the Mac mini
```

The "convenient store" and "optional split shop" items from the original slice-3 line are recorded as deferred in §5 above and removed from PLAN.md (decision-once UX supersedes them).
