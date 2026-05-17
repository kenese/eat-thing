# Phase 4 — Build-to-cart (New World) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the user's eat-thing shopping list and populate their New World trolley with the right products, with the user confirming any ambiguous matches before send.

**Architecture:** Two scraper jobs in sequence (`compare_prices` → user review → `add_to_cart`), separated by a manual-pick step. Reshape the matcher to return top-N candidates ranked by per-100g/ml unit price, restricted to packs that meet the recipe's required quantity. The cart-write diffs against the live trolley for idempotency. Candidates + user pick persisted on `shopping_list_prices`. No new tables; one new `JobType`.

**Tech Stack:** Drizzle ORM (Postgres on Supabase), Playwright (scraper), Cheerio (parsing), Express (server), React + TanStack Query (web), Vitest + React Testing Library + Playwright (tests). Spec: [`docs/superpowers/specs/2026-05-17-phase4-build-to-cart-design.md`](../specs/2026-05-17-phase4-build-to-cart-design.md).

---

## File Map

**Schema + types:**
- Modify: `apps/server/src/db/schema/prices.ts` — add `candidates` JSONB + `chosenSku` text
- Create: `apps/server/drizzle/0011_phase4_candidates.sql` — migration
- Modify: `apps/server/drizzle/meta/_journal.json` — register migration
- Modify: `packages/shared/src/index.ts` — add `ProductCandidate`, `ProductCandidateUnit`, `CartActionResult`, `CartJobResult`, and extend the existing `ShoppingListPrice` with `candidates` + `chosenSku`

**Scraper (matcher):**
- Modify: `apps/scraper/src/stores/newworld.ts` — parsers extract packSize / unitPrice / onSpecial; new `parseTrolley` helper
- Modify: `apps/scraper/src/stores/match.ts` — `rankCandidates` rewrite (alongside legacy `pickMatch`, which gets removed in the same task)
- Modify: `apps/scraper/src/stores/match.test.ts` — full rewrite for new function
- Modify: `apps/scraper/src/stores/newworld.test.ts` — fixtures for new parser fields + trolley HTML + diff logic
- Create: `apps/scraper/src/stores/newworld-trolley.fixture.html` — fixture file for trolley HTML
- Create: `apps/scraper/src/stores/newworld-product-detail.fixture.html` — fixture file for product detail HTML

**Scraper (cart write):**
- Modify: `apps/scraper/src/stores/newworld.ts` — `addToCart` flow on the adapter (read trolley → diff → loop product pages → re-read)
- Modify: `apps/scraper/src/worker-sdk/types.ts` — add `'add_to_cart'` to `JobType`

**Server:**
- Modify: `apps/server/src/routes/scraper.ts` — extend `applyComparePricesResult` to write `candidates` + `chosenSku`; add `applyAddToCartResult`
- Modify: `apps/server/src/routes/shopping-lists.ts` — `GET /:id/prices` response includes `candidates` + `chosenSku`; new `PATCH /items/:id/chosen-sku`; new `POST /:id/send-to-cart`; new `GET /:id/cart-result`
- Modify: `apps/server/src/routes/shopping-lists.test.ts` — tests for the three new/extended endpoints
- Modify: `apps/server/src/routes/scraper.test.ts` — tests for new result-handler paths

**Web:**
- Modify: `apps/web/src/hooks/usePricesForList.ts` — add `useChooseSku`, `useSendToCart`, `useCartResult` alongside the existing `usePricesForList` / `useRefreshPrices`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx` — rename button, add state badges, manual-pick expand, send-to-cart, reconcile modal
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css` — styles for badge / candidate strip / reconcile modal
- Create: `apps/web/src/pages/ShoppingListPage/CandidatePicker.tsx` — small component for manual-pick expand
- Create: `apps/web/src/pages/ShoppingListPage/ReconcileModal.tsx` — modal showing perItem rows + trolley link
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx` — tests for new UX paths

**Smoke + docs:**
- Modify: `apps/scraper/src/smoke/newworld.ts` — add `cart` mode
- Modify: `PLAN.md` — move Phase 4 items to Done; update "Currently on"
- Modify: `DECISIONS.md` — append a D23 entry capturing build-to-cart implementation choices

---

## Task 1: Migration 0011 — candidates + chosenSku on shopping_list_prices

**Files:**
- Create: `apps/server/drizzle/0011_phase4_candidates.sql`
- Modify: `apps/server/drizzle/meta/_journal.json`
- Modify: `apps/server/src/db/schema/prices.ts`

- [ ] **Step 1: Write the SQL migration**

Create `apps/server/drizzle/0011_phase4_candidates.sql`:

```sql
ALTER TABLE "shopping_list_prices" ADD COLUMN IF NOT EXISTS "candidates" jsonb;
ALTER TABLE "shopping_list_prices" ADD COLUMN IF NOT EXISTS "chosen_sku" text;
```

- [ ] **Step 2: Register migration in journal**

Edit `apps/server/drizzle/meta/_journal.json`. After the `0010_shopping_list_item_recipe_id` entry, before the closing `]`, add:

```json
,
{
  "idx": 11,
  "version": "7",
  "when": 1747785600000,
  "tag": "0011_phase4_candidates",
  "breakpoints": true
}
```

(Keep the trailing comma rules of JSON in mind — the existing last entry should remain followed by your new one; close the array as before.)

- [ ] **Step 3: Update Drizzle schema**

Edit `apps/server/src/db/schema/prices.ts`. Replace the file contents with:

```ts
import { pgTable, uuid, text, timestamp, numeric, boolean, unique, jsonb } from 'drizzle-orm/pg-core';
import { shoppingListItems } from './shopping.js';
import { storeEnum } from './enums.js';

export const shoppingListPrices = pgTable('shopping_list_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  shoppingListItemId: uuid('shopping_list_item_id').notNull().references(() => shoppingListItems.id, { onDelete: 'cascade' }),
  store: storeEnum('store').notNull(),
  sku: text('sku'),
  name: text('name'),
  price: numeric('price', { precision: 10, scale: 2 }),
  inStock: boolean('in_stock').notNull().default(true),
  matched: boolean('matched').notNull().default(true),
  candidates: jsonb('candidates'),
  chosenSku: text('chosen_sku'),
  checkedAt: timestamp('checked_at').notNull().defaultNow(),
}, t => [unique().on(t.shoppingListItemId, t.store)]);
```

- [ ] **Step 4: Apply the migration**

Run: `pnpm --filter @eat/server db:migrate`
Expected: output ending in something like `Migration 0011_phase4_candidates applied` with no errors. (CLAUDE.md note: do not use `db:push` — it's broken on this project.)

- [ ] **Step 5: Sanity-check the new columns**

Run: `pnpm --filter @eat/server exec drizzle-kit introspect 2>&1 | grep -i candidates || echo "fallback: use psql"`
Expected: a candidates entry; if Drizzle introspection isn't accessible, you can also verify with a one-off Drizzle query.

- [ ] **Step 6: Commit**

```bash
git add apps/server/drizzle/0011_phase4_candidates.sql apps/server/drizzle/meta/_journal.json apps/server/src/db/schema/prices.ts
git commit -m "feat(db): add candidates + chosen_sku to shopping_list_prices (migration 0011)"
```

---

## Task 2: Shared types — `ProductCandidate`, cart result shapes

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add new types**

Append to `packages/shared/src/index.ts` (after the existing exports):

```ts
// ─── Phase 4: build-to-cart ───────────────────────────────────────────────────

export type ProductCandidateUnit = 'g' | 'ml' | 'count';

export interface ProductCandidate {
  sku: string;
  name: string;
  brand: string | null;
  packSize: { qty: number; unit: ProductCandidateUnit } | null;
  price: number;
  unitPrice: { value: number; per: ProductCandidateUnit } | null;
  inStock: boolean;
  onSpecial: boolean;
  cartQty: number;
  resolution: 'sole' | 'preferred' | 'manual';
}

export interface CartActionResult {
  shoppingListItemId: string;
  sku: string;
  requestedQty: number;
  action: 'added' | 'already_in_cart' | 'qty_increased' | 'failed';
  failureReason?: string;
}

export interface CartJobResult {
  perItem: CartActionResult[];
  cartTotalNzd: number;
  trolleyUrl: string;
}

export interface SendToCartResponse {
  jobId: string;
  skipped: string[];
}

export interface CartResultResponse {
  job: { id: string; status: ScraperJobStatus; error: string | null } | null;
  result: CartJobResult | null;
}
```

- [ ] **Step 1b: Extend the existing `ShoppingListPrice` type**

In the same file, find `export interface ShoppingListPrice { ... }` (around line 344). Add two new fields:

```ts
export interface ShoppingListPrice {
  id: string;
  shoppingListItemId: string;
  store: Store;
  sku: string | null;
  name: string | null;
  price: number | null;
  inStock: boolean;
  matched: boolean;
  candidates: ProductCandidate[];
  chosenSku: string | null;
  checkedAt: string;
}
```

(`ProductCandidate` referenced here is defined above in the appended block — the order of declarations doesn't matter for TS interfaces in the same file.)

- [ ] **Step 2: Build the shared package**

Run: `pnpm --filter @eat/shared build`
Expected: clean build, types emitted to `packages/shared/dist/`.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/dist
git commit -m "feat(shared): ProductCandidate + CartJobResult types for phase 4"
```

---

## Task 3: Parser additions in newworld.ts — packSize / unitPrice / onSpecial

**Files:**
- Modify: `apps/scraper/src/stores/newworld.ts`
- Modify: `apps/scraper/src/stores/newworld.test.ts`

- [ ] **Step 1: Write failing tests for the new parser fields**

In `apps/scraper/src/stores/newworld.test.ts`, append:

```ts
import { describe, it, expect } from 'vitest';
import { parseSearchResults } from './newworld.js';

describe('parseSearchResults — phase 4 fields', () => {
  it('extracts pack size from titles in g, kg, ml, L, pack', () => {
    const html = `
      <div data-testid="product-NW001-x"><p data-testid="product-title">Flour Standard White 1.5kg</p><p data-testid="price-dollars">3</p><p data-testid="price-cents">99</p><p data-testid="unit-price">$0.27 / 100g</p><button data-testid="add-to-cart"></button></div>
      <div data-testid="product-NW002-x"><p data-testid="product-title">Sugar Caster 500g</p><p data-testid="price-dollars">2</p><p data-testid="price-cents">50</p><p data-testid="unit-price">$0.50 / 100g</p><button data-testid="add-to-cart"></button></div>
      <div data-testid="product-NW003-x"><p data-testid="product-title">Milk Standard 2L</p><p data-testid="price-dollars">4</p><p data-testid="price-cents">20</p><p data-testid="unit-price">$0.21 / 100ml</p><button data-testid="add-to-cart"></button></div>
      <div data-testid="product-NW004-x"><p data-testid="product-title">Eggs Free Range Size 7 12pk</p><p data-testid="price-dollars">8</p><p data-testid="price-cents">99</p><p data-testid="unit-price">$0.75 each</p><button data-testid="add-to-cart"></button></div>
    `;
    const out = parseSearchResults(html);
    expect(out[0]?.packSize).toEqual({ qty: 1500, unit: 'g' });
    expect(out[1]?.packSize).toEqual({ qty: 500, unit: 'g' });
    expect(out[2]?.packSize).toEqual({ qty: 2000, unit: 'ml' });
    expect(out[3]?.packSize).toEqual({ qty: 12, unit: 'count' });
  });

  it('extracts unit price normalised to per-g / per-ml / per-count', () => {
    const html = `
      <div data-testid="product-NW001-x"><p data-testid="product-title">Flour 1.5kg</p><p data-testid="price-dollars">3</p><p data-testid="price-cents">99</p><p data-testid="unit-price">$0.27 / 100g</p><button data-testid="add-to-cart"></button></div>
      <div data-testid="product-NW002-x"><p data-testid="product-title">Milk 2L</p><p data-testid="price-dollars">4</p><p data-testid="price-cents">20</p><p data-testid="unit-price">$0.21 / 100ml</p><button data-testid="add-to-cart"></button></div>
    `;
    const out = parseSearchResults(html);
    expect(out[0]?.unitPrice).toEqual({ value: 0.0027, per: 'g' });
    expect(out[1]?.unitPrice).toEqual({ value: 0.0021, per: 'ml' });
  });

  it('detects on-special items via the specials badge', () => {
    const html = `
      <div data-testid="product-NW001-x"><p data-testid="product-title">Cheese 500g</p><p data-testid="price-dollars">5</p><p data-testid="price-cents">99</p><span data-testid="special-badge">SPECIAL</span><button data-testid="add-to-cart"></button></div>
      <div data-testid="product-NW002-x"><p data-testid="product-title">Butter 250g</p><p data-testid="price-dollars">4</p><p data-testid="price-cents">50</p><button data-testid="add-to-cart"></button></div>
    `;
    const out = parseSearchResults(html);
    expect(out[0]?.onSpecial).toBe(true);
    expect(out[1]?.onSpecial).toBe(false);
  });

  it('returns null packSize / unitPrice when the title or label is unparseable', () => {
    const html = `<div data-testid="product-NW099-x"><p data-testid="product-title">Mystery item</p><p data-testid="price-dollars">9</p><p data-testid="price-cents">99</p><button data-testid="add-to-cart"></button></div>`;
    const out = parseSearchResults(html);
    expect(out[0]?.packSize).toBeNull();
    expect(out[0]?.unitPrice).toBeNull();
    expect(out[0]?.onSpecial).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, watch them fail**

Run: `pnpm --filter @eat/scraper test -- newworld.test.ts`
Expected: 4 failing tests, errors about `packSize`/`unitPrice`/`onSpecial` being undefined on `ParsedSearchResult`.

- [ ] **Step 3: Implement the parser additions**

Edit `apps/scraper/src/stores/newworld.ts`. Replace the `ParsedSearchResult` interface + `parseSearchResults` with:

```ts
export type PackUnit = 'g' | 'ml' | 'count';

export interface ParsedSearchResult {
  sku: string;
  name: string;
  brand: string | null;
  price: number;
  inStock: boolean;
  packSize: { qty: number; unit: PackUnit } | null;
  unitPrice: { value: number; per: PackUnit } | null;
  onSpecial: boolean;
}

const PACK_SIZE_RE = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pk|pack|ea|each)\b/i;
const UNIT_PRICE_RE = /\$\s*(\d+(?:\.\d+)?)\s*(?:\/|per)\s*(\d+)?\s*(kg|g|ml|l|each|ea|count)/i;

export function parsePackSize(title: string): { qty: number; unit: PackUnit } | null {
  const m = title.match(PACK_SIZE_RE);
  if (!m || !m[1] || !m[2]) return null;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === 'kg') return { qty: n * 1000, unit: 'g' };
  if (u === 'g') return { qty: n, unit: 'g' };
  if (u === 'l') return { qty: n * 1000, unit: 'ml' };
  if (u === 'ml') return { qty: n, unit: 'ml' };
  return { qty: n, unit: 'count' };
}

export function parseUnitPrice(text: string): { value: number; per: PackUnit } | null {
  if (!text) return null;
  const m = text.match(UNIT_PRICE_RE);
  if (!m || !m[1] || !m[3]) return null;
  const dollars = parseFloat(m[1]);
  const denom = m[2] ? parseFloat(m[2]) : 1;
  const u = m[3].toLowerCase();
  if (u === 'kg') return { value: dollars / 1000 / denom, per: 'g' };
  if (u === 'g')  return { value: dollars / denom, per: 'g' };
  if (u === 'l')  return { value: dollars / 1000 / denom, per: 'ml' };
  if (u === 'ml') return { value: dollars / denom, per: 'ml' };
  return { value: dollars / denom, per: 'count' };
}

export function parseSearchResults(html: string): ParsedSearchResult[] {
  const $ = cheerio.load(html);
  const out: ParsedSearchResult[] = [];
  $('div[data-testid^="product-"]').each((_i, el) => {
    const $el = $(el);
    const testId = $el.attr('data-testid') ?? '';
    const skuMatch = testId.match(/^product-(\w+)-/);
    const sku = skuMatch?.[1] ?? '';
    const name = $el.find('p[data-testid="product-title"]').first().text().trim();
    const dollars = $el.find('p[data-testid="price-dollars"]').first().text().trim();
    const cents = $el.find('p[data-testid="price-cents"]').first().text().trim();
    const price = parseFloat(`${dollars}.${cents.padStart(2, '0')}`);
    const unitPriceText = $el.find('p[data-testid="unit-price"]').first().text().trim();
    const inStock = $el.find('button[data-testid="add-to-cart"]').length > 0;
    const onSpecial = $el.find('[data-testid="special-badge"]').length > 0;
    if (sku && name && !Number.isNaN(price)) {
      out.push({
        sku,
        name,
        brand: null,
        price,
        inStock,
        packSize: parsePackSize(name),
        unitPrice: parseUnitPrice(unitPriceText),
        onSpecial,
      });
    }
  });
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @eat/scraper test -- newworld.test.ts`
Expected: all newworld tests pass, including pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/stores/newworld.ts apps/scraper/src/stores/newworld.test.ts
git commit -m "feat(scraper): extract packSize / unitPrice / onSpecial from NW search results"
```

---

## Task 4: `rankCandidates` — top-N with three resolutions

**Files:**
- Modify: `apps/scraper/src/stores/match.ts` (replace `pickMatch` with `rankCandidates`)
- Modify: `apps/scraper/src/stores/match.test.ts` (rewrite)

- [ ] **Step 1: Write failing tests**

Replace `apps/scraper/src/stores/match.test.ts` entirely with:

```ts
import { describe, it, expect } from 'vitest';
import { rankCandidates, type RankInput } from './match.js';
import type { ParsedSearchResult } from './newworld.js';

function mk(over: Partial<ParsedSearchResult> & { sku: string; name: string; price: number }): ParsedSearchResult {
  return {
    brand: null,
    inStock: true,
    onSpecial: false,
    packSize: null,
    unitPrice: null,
    ...over,
  };
}

const baseInput = (over: Partial<RankInput> = {}): RankInput => ({
  item: { id: 'i1', name: 'Flour', canonicalFoodId: 'cf-flour', requiredQty: 1000, requiredUnit: 'g' },
  candidates: [],
  preferredBrandsByCanonicalFood: {},
  topN: 5,
  ...over,
});

describe('rankCandidates', () => {
  it('marks the lone surviving candidate as "sole"', () => {
    const c = mk({
      sku: 'NW001', name: 'Flour 1.5kg', price: 3.99,
      packSize: { qty: 1500, unit: 'g' },
      unitPrice: { value: 0.0027, per: 'g' },
    });
    const out = rankCandidates(baseInput({ candidates: [c] }));
    expect(out).toHaveLength(1);
    expect(out[0]?.resolution).toBe('sole');
    expect(out[0]?.cartQty).toBe(1);
  });

  it('ranks viable candidates by unit price ascending', () => {
    const cheap = mk({
      sku: 'NW001', name: 'Flour 1.5kg', price: 3.99, brand: 'Pams',
      packSize: { qty: 1500, unit: 'g' }, unitPrice: { value: 0.0027, per: 'g' },
    });
    const dear = mk({
      sku: 'NW002', name: 'Flour Edmonds 1kg', price: 4.50, brand: 'Edmonds',
      packSize: { qty: 1000, unit: 'g' }, unitPrice: { value: 0.0045, per: 'g' },
    });
    const out = rankCandidates(baseInput({ candidates: [dear, cheap] }));
    expect(out[0]?.sku).toBe('NW001');
    expect(out[1]?.sku).toBe('NW002');
  });

  it('preferred-brand wins even when a cheaper non-preferred candidate exists ("preferred" resolution)', () => {
    const cheapNonPreferred = mk({
      sku: 'NW001', name: 'Flour 1.5kg', price: 3.99, brand: 'Pams',
      packSize: { qty: 1500, unit: 'g' }, unitPrice: { value: 0.0027, per: 'g' },
    });
    const preferred = mk({
      sku: 'NW002', name: 'Flour Edmonds 1kg', price: 4.50, brand: 'Edmonds',
      packSize: { qty: 1000, unit: 'g' }, unitPrice: { value: 0.0045, per: 'g' },
    });
    const out = rankCandidates(baseInput({
      candidates: [cheapNonPreferred, preferred],
      preferredBrandsByCanonicalFood: { 'cf-flour': new Set(['Edmonds']) },
    }));
    expect(out[0]?.sku).toBe('NW002');
    expect(out[0]?.resolution).toBe('preferred');
  });

  it('drops to "manual" when no preferred brand exists and multiple plausible candidates remain', () => {
    const a = mk({
      sku: 'NW001', name: 'Flour 1.5kg', price: 3.99, brand: 'Pams',
      packSize: { qty: 1500, unit: 'g' }, unitPrice: { value: 0.0027, per: 'g' },
    });
    const b = mk({
      sku: 'NW002', name: 'Flour 1kg', price: 3.20, brand: 'Edmonds',
      packSize: { qty: 1000, unit: 'g' }, unitPrice: { value: 0.0032, per: 'g' },
    });
    const out = rankCandidates(baseInput({ candidates: [a, b] }));
    expect(out[0]?.resolution).toBe('manual');
    expect(out[1]?.resolution).toBe('manual');
  });

  it('filters out packs too small for the required qty', () => {
    const small = mk({
      sku: 'NW001', name: 'Flour 500g', price: 1.50, brand: 'Pams',
      packSize: { qty: 500, unit: 'g' }, unitPrice: { value: 0.003, per: 'g' },
    });
    const big = mk({
      sku: 'NW002', name: 'Flour 1.5kg', price: 3.99, brand: 'Pams',
      packSize: { qty: 1500, unit: 'g' }, unitPrice: { value: 0.0027, per: 'g' },
    });
    const out = rankCandidates(baseInput({
      item: { id: 'i', name: 'Flour', canonicalFoodId: null, requiredQty: 1000, requiredUnit: 'g' },
      candidates: [small, big],
    }));
    const survivor = out.find(c => c.resolution !== 'manual');
    expect(survivor?.sku).toBe('NW002');
  });

  it('computes cartQty multiplier when no single pack meets the required qty', () => {
    const c = mk({
      sku: 'NW001', name: 'Flour 1.5kg', price: 3.99, brand: 'Pams',
      packSize: { qty: 1500, unit: 'g' }, unitPrice: { value: 0.0027, per: 'g' },
    });
    const out = rankCandidates(baseInput({
      item: { id: 'i', name: 'Flour', canonicalFoodId: null, requiredQty: 3000, requiredUnit: 'g' },
      candidates: [c],
    }));
    expect(out[0]?.cartQty).toBe(2);
    expect(out[0]?.resolution).toBe('sole');
  });

  it('places null-packSize candidates in the manual-fallback pile (manual resolution)', () => {
    const noSize = mk({ sku: 'NW099', name: 'Flour Mystery', price: 4.20, brand: null });
    const sized  = mk({
      sku: 'NW001', name: 'Flour 1.5kg', price: 3.99, brand: 'Pams',
      packSize: { qty: 1500, unit: 'g' }, unitPrice: { value: 0.0027, per: 'g' },
    });
    const out = rankCandidates(baseInput({ candidates: [noSize, sized] }));
    const sizedOut = out.find(c => c.sku === 'NW001');
    const noSizeOut = out.find(c => c.sku === 'NW099');
    expect(sizedOut?.resolution).toBe('sole');
    expect(noSizeOut?.resolution).toBe('manual');
  });

  it('trivially passes the sufficient-pack filter for count items', () => {
    const c = mk({
      sku: 'NW001', name: 'Eggs Free Range 6pk', price: 4.50, brand: 'Mainland',
      packSize: { qty: 6, unit: 'count' }, unitPrice: { value: 0.75, per: 'count' },
    });
    const out = rankCandidates(baseInput({
      item: { id: 'i', name: 'Eggs', canonicalFoodId: 'cf-eggs', requiredQty: 6, requiredUnit: 'count' },
      candidates: [c],
    }));
    expect(out[0]?.resolution).toBe('sole');
    expect(out[0]?.cartQty).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to watch them fail**

Run: `pnpm --filter @eat/scraper test -- match.test.ts`
Expected: every test fails, errors about `rankCandidates` not exported.

- [ ] **Step 3: Implement `rankCandidates`**

Replace `apps/scraper/src/stores/match.ts` with:

```ts
import type { ProductCandidate, ProductCandidateUnit } from '@eat/shared';
import type { ParsedSearchResult } from './newworld.js';

export interface ListItemForMatch {
  id: string;
  name: string;
  canonicalFoodId: string | null;
  requiredQty: number;
  requiredUnit: ProductCandidateUnit;
}

export interface RankInput {
  item: ListItemForMatch;
  candidates: ParsedSearchResult[];
  preferredBrandsByCanonicalFood: Record<string, Set<string>>;
  topN: number;
}

const STOPWORDS = new Set(['the', 'a', 'and', 'or', 'pk', 'pack', 'g', 'kg', 'ml', 'l']);

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !STOPWORDS.has(t)),
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

function normaliseUnitPrice(up: ParsedSearchResult['unitPrice']): number | null {
  if (!up) return null;
  return up.value;
}

function sufficientPackMultiplier(
  pack: ParsedSearchResult['packSize'],
  requiredQty: number,
  requiredUnit: ProductCandidateUnit,
): number | null {
  if (!pack) return null;
  if (pack.unit !== requiredUnit) return null;
  if (pack.qty <= 0) return null;
  return Math.max(1, Math.ceil(requiredQty / pack.qty));
}

export function rankCandidates(input: RankInput): ProductCandidate[] {
  const { item, candidates, preferredBrandsByCanonicalFood, topN } = input;
  if (candidates.length === 0) return [];

  const itemTokens = tokens(item.name);

  type Scored = {
    cand: ParsedSearchResult;
    cartQty: number | null;
    nameScore: number;
    unitPrice: number | null;
    isPreferred: boolean;
  };

  const preferredBrands = item.canonicalFoodId ? preferredBrandsByCanonicalFood[item.canonicalFoodId] : undefined;

  const scored: Scored[] = candidates.map(c => ({
    cand: c,
    cartQty: sufficientPackMultiplier(c.packSize, item.requiredQty, item.requiredUnit),
    nameScore: tokenOverlap(tokens(c.name), itemTokens),
    unitPrice: normaliseUnitPrice(c.unitPrice),
    isPreferred: !!(preferredBrands && c.brand && preferredBrands.has(c.brand)),
  }));

  const viable = scored.filter(s => s.cartQty !== null && s.unitPrice !== null && s.nameScore > 0);
  const fallback = scored.filter(s => !viable.includes(s) && s.nameScore > 0);

  viable.sort((a, b) => (a.unitPrice! - b.unitPrice!));

  let resolution: 'sole' | 'preferred' | 'manual';
  let winnerSku: string | null = null;

  if (viable.length === 1) {
    resolution = 'sole';
    winnerSku = viable[0]!.cand.sku;
  } else if (viable.length > 1) {
    const preferredInTop3 = viable.slice(0, 3).find(s => s.isPreferred);
    if (preferredInTop3) {
      resolution = 'preferred';
      winnerSku = preferredInTop3.cand.sku;
    } else {
      resolution = 'manual';
    }
  } else {
    resolution = 'manual';
  }

  const orderedViable = winnerSku
    ? [viable.find(s => s.cand.sku === winnerSku)!, ...viable.filter(s => s.cand.sku !== winnerSku)]
    : viable;

  const combined: Scored[] = [...orderedViable, ...fallback];
  const sliced = combined.slice(0, Math.max(topN, 1));

  return sliced.map((s, idx): ProductCandidate => {
    const isViable = viable.includes(s);
    const candResolution: ProductCandidate['resolution'] =
      isViable && idx === 0 && resolution !== 'manual' ? resolution : 'manual';
    return {
      sku: s.cand.sku,
      name: s.cand.name,
      brand: s.cand.brand,
      packSize: s.cand.packSize,
      price: s.cand.price,
      unitPrice: s.cand.unitPrice,
      inStock: s.cand.inStock,
      onSpecial: s.cand.onSpecial,
      cartQty: s.cartQty ?? 1,
      resolution: candResolution,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @eat/scraper test -- match.test.ts`
Expected: all 8 `rankCandidates` tests pass.

- [ ] **Step 5: Update callers — newworld.ts adapter uses rankCandidates**

In `apps/scraper/src/stores/newworld.ts`, find the `compare_prices` branch in `handle()` (around the `pickMatch` call). Replace the inner loop with:

```ts
import { rankCandidates } from './match.js';
import type { ProductCandidate } from '@eat/shared';

// inside `if (job.type === 'compare_prices')`:
const items: Array<{
  shoppingListItemId: string;
  candidates: ProductCandidate[];
  chosenSku: string | null;
}> = [];
for (const item of payload.items) {
  await page.goto(SEARCH_URL(item.name), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('p[data-testid="product-title"]', { timeout: 15000 }).catch(() => {});
  const html = await page.content();
  if (isLoggedOutPage(html)) {
    return { ok: false, error: 'session_expired' };
  }
  const parsed = parseSearchResults(html);
  const ranked = rankCandidates({
    item: {
      id: item.id,
      name: item.name,
      canonicalFoodId: item.canonicalFoodId,
      requiredQty: item.requiredQty,
      requiredUnit: item.requiredUnit,
    },
    candidates: parsed,
    preferredBrandsByCanonicalFood: preferredMap,
    topN: 5,
  });
  const auto = ranked.find(c => c.resolution === 'sole' || c.resolution === 'preferred');
  items.push({
    shoppingListItemId: item.id,
    candidates: ranked,
    chosenSku: auto?.sku ?? null,
  });
}
return { ok: true, data: { items } };
```

Also extend the `ComparePayload` shape so each `item` now includes `canonicalFoodId`, `requiredQty`, and `requiredUnit`:

```ts
interface ComparePayload {
  shoppingListId: string;
  items: Array<{
    id: string;
    name: string;
    canonicalFoodId: string | null;
    requiredQty: number;
    requiredUnit: 'g' | 'ml' | 'count';
  }>;
  preferredBrandsByCanonicalFood: Record<string, string[]>;
}
```

Delete the old `pickMatch` import in this file (it's gone in step 3).

- [ ] **Step 6: Run the full scraper suite**

Run: `pnpm --filter @eat/scraper test`
Expected: green across `match.test.ts`, `newworld.test.ts`, and `encryption.test.ts` / `session.test.ts` etc.

- [ ] **Step 7: Commit**

```bash
git add apps/scraper/src/stores/match.ts apps/scraper/src/stores/match.test.ts apps/scraper/src/stores/newworld.ts
git commit -m "feat(scraper): rankCandidates returns top-N with sole / preferred / manual resolutions"
```

---

## Task 5: Wire `compare_prices` job result to write candidates + chosenSku

**Files:**
- Modify: `apps/server/src/routes/scraper.ts` — extend `applyComparePricesResult`
- Modify: `apps/server/src/routes/shopping-lists.ts` — extend `GET /:id/prices` response
- Modify: `apps/server/src/routes/scraper.test.ts`
- Modify: `apps/server/src/routes/shopping-lists.test.ts`

- [ ] **Step 1: Write failing test for the new result-handler shape**

In `apps/server/src/routes/scraper.test.ts`, add to the file (near the existing `compare_prices` tests):

```ts
it('writes candidates + chosenSku for each item when compare_prices completes', async () => {
  mocks.selectLimit.mockResolvedValueOnce([{ id: 'job-1', type: 'compare_prices', householdId: 'h', store: 'new_world' }]);

  const body = {
    ok: true,
    data: {
      items: [
        {
          shoppingListItemId: 'sli-1',
          candidates: [
            {
              sku: 'NW001', name: 'Flour 1.5kg', brand: 'Pams',
              packSize: { qty: 1500, unit: 'g' }, price: 3.99,
              unitPrice: { value: 0.0027, per: 'g' },
              inStock: true, onSpecial: false, cartQty: 1, resolution: 'sole',
            },
          ],
          chosenSku: 'NW001',
        },
      ],
    },
  };
  const res = await postJobResult('job-1', body);
  expect(res.status).toBe(200);
  expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
    shoppingListItemId: 'sli-1',
    sku: 'NW001',
    chosenSku: 'NW001',
    candidates: body.data.items[0]!.candidates,
  }));
});
```

(`postJobResult` is the existing helper in the test file; if it doesn't exist, look at the pattern used by the current `compare_prices` test and follow it. Add `insertValues` / `selectLimit` mocks to the test harness if not already present.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @eat/server test -- scraper.test.ts`
Expected: FAIL — the existing handler doesn't write `candidates` / `chosenSku`.

- [ ] **Step 3: Update the result handler**

In `apps/server/src/routes/scraper.ts`, replace `ComparePricesItem` + `applyComparePricesResult` with:

```ts
import type { ProductCandidate } from '@eat/shared';

interface ComparePricesItem {
  shoppingListItemId: string;
  candidates: ProductCandidate[];
  chosenSku: string | null;
}

async function applyComparePricesResult(store: string, data: Record<string, unknown>): Promise<void> {
  const items = (data['items'] ?? []) as ComparePricesItem[];
  if (items.length === 0) return;

  await db.transaction(async tx => {
    for (const item of items) {
      const chosen = item.chosenSku
        ? item.candidates.find(c => c.sku === item.chosenSku) ?? null
        : null;
      const mirror = chosen ?? item.candidates[0] ?? null;
      await tx
        .insert(shoppingListPrices)
        .values({
          shoppingListItemId: item.shoppingListItemId,
          store: store as 'new_world' | 'paknsave' | 'woolworths',
          sku: mirror?.sku ?? null,
          name: mirror?.name ?? null,
          price: mirror?.price !== undefined && mirror.price !== null ? String(mirror.price) : null,
          inStock: mirror?.inStock ?? true,
          matched: !!mirror,
          candidates: item.candidates,
          chosenSku: item.chosenSku,
          checkedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [shoppingListPrices.shoppingListItemId, shoppingListPrices.store],
          set: {
            sku: mirror?.sku ?? null,
            name: mirror?.name ?? null,
            price: mirror?.price !== undefined && mirror.price !== null ? String(mirror.price) : null,
            inStock: mirror?.inStock ?? true,
            matched: !!mirror,
            candidates: item.candidates,
            chosenSku: item.chosenSku,
            checkedAt: new Date(),
          },
        });
    }
  });
}
```

- [ ] **Step 4: Run scraper.test.ts to verify it passes**

Run: `pnpm --filter @eat/server test -- scraper.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Extend `GET /:id/prices` response — failing test**

In `apps/server/src/routes/shopping-lists.test.ts`, add (near the existing prices tests):

```ts
it('returns candidates + chosenSku on the prices payload', async () => {
  mocks.selectFrom.mockResolvedValueOnce([
    {
      id: 'p-1',
      shoppingListItemId: 'sli-1',
      store: 'new_world',
      sku: 'NW001',
      name: 'Flour 1.5kg',
      price: '3.99',
      inStock: true,
      matched: true,
      candidates: [{ sku: 'NW001', name: 'Flour 1.5kg', brand: 'Pams', packSize: { qty: 1500, unit: 'g' }, price: 3.99, unitPrice: { value: 0.0027, per: 'g' }, inStock: true, onSpecial: false, cartQty: 1, resolution: 'sole' }],
      chosenSku: 'NW001',
      checkedAt: new Date('2026-05-18T00:00:00Z'),
    },
  ]);
  mocks.selectFrom.mockResolvedValueOnce([]); // no jobs
  const res = await getPrices('LIST-1');
  expect(res.body.prices[0].candidates).toHaveLength(1);
  expect(res.body.prices[0].chosenSku).toBe('NW001');
});
```

- [ ] **Step 6: Run failing test**

Run: `pnpm --filter @eat/server test -- shopping-lists.test.ts`
Expected: FAIL because the existing route doesn't return `candidates` / `chosenSku`.

- [ ] **Step 7: Extend the GET handler**

In `apps/server/src/routes/shopping-lists.ts`, edit the `GET /:id/prices` route. In the `db.select({...})` for `shoppingListPrices`, add:

```ts
candidates: shoppingListPrices.candidates,
chosenSku: shoppingListPrices.chosenSku,
```

And in the response mapping:

```ts
res.json({
  prices: priceRows.map(r => ({
    ...r,
    price: r.price !== null ? Number(r.price) : null,
    checkedAt: r.checkedAt instanceof Date ? r.checkedAt.toISOString() : r.checkedAt,
    candidates: r.candidates ?? [],
    chosenSku: r.chosenSku ?? null,
  })),
  job: job ? { id: job.id, status: job.status, error: job.error } : null,
});
```

- [ ] **Step 8: Make sure the enqueue route passes the new payload fields**

In `apps/server/src/routes/shopping-lists.ts`, find `POST /:id/refresh-prices`. The current payload is `{ shoppingListId: listId }`. Extend it so the scraper has what it needs for `rankCandidates`:

```ts
const itemRows = await db
  .select({
    id: shoppingListItems.id,
    name: shoppingListItems.name,
    canonicalFoodId: shoppingListItems.canonicalFoodId,
    qty: shoppingListItems.qty,
    unit: shoppingListItems.unit,
  })
  .from(shoppingListItems)
  .where(eq(shoppingListItems.shoppingListId, listId));

const preferredRows = await db
  .select({ canonicalFoodId: supermarketProducts.canonicalFoodId, brand: supermarketProducts.brand })
  .from(supermarketProducts)
  .where(and(eq(supermarketProducts.householdId, req.householdId), eq(supermarketProducts.preferred, true)));

const preferredBrandsByCanonicalFood: Record<string, string[]> = {};
for (const r of preferredRows) {
  if (!r.canonicalFoodId || !r.brand) continue;
  (preferredBrandsByCanonicalFood[r.canonicalFoodId] ??= []).push(r.brand);
}

const inserted = await db
  .insert(scraperJobs)
  .values({
    householdId: req.householdId,
    store: 'new_world',
    type: 'compare_prices',
    payload: {
      shoppingListId: listId,
      items: itemRows.map(r => ({
        id: r.id,
        name: r.name,
        canonicalFoodId: r.canonicalFoodId,
        requiredQty: r.qty,
        requiredUnit: r.unit === 'ml' || r.unit === 'count' ? r.unit : 'g',
      })),
      preferredBrandsByCanonicalFood,
    },
    status: 'pending',
  })
  .returning({ id: scraperJobs.id });
```

(The `requiredUnit` mapping is a small simplification: we send `g` for anything that isn't ml or count. The scraper-side filter is unit-strict, so if the canonical-food unit is something exotic, it'll fall through to manual fallback. We refine later if real data shows we need to.)

- [ ] **Step 9: Run tests**

Run: `pnpm --filter @eat/server test -- shopping-lists.test.ts scraper.test.ts`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/server/src/routes/scraper.ts apps/server/src/routes/shopping-lists.ts apps/server/src/routes/scraper.test.ts apps/server/src/routes/shopping-lists.test.ts
git commit -m "feat(server): persist top-N candidates + chosenSku from compare_prices"
```

---

## Task 6: Server — PATCH chosen-sku endpoint

**Files:**
- Modify: `apps/server/src/routes/shopping-lists.ts`
- Modify: `apps/server/src/routes/shopping-lists.test.ts`

- [ ] **Step 1: Write failing test**

In `apps/server/src/routes/shopping-lists.test.ts`:

```ts
it('PATCH /items/:id/chosen-sku updates chosenSku when sku is in candidates', async () => {
  mocks.selectLimit.mockResolvedValueOnce([{
    candidates: [
      { sku: 'NW001', name: 'Flour 1.5kg', brand: 'Pams', packSize: { qty: 1500, unit: 'g' }, price: 3.99, unitPrice: { value: 0.0027, per: 'g' }, inStock: true, onSpecial: false, cartQty: 1, resolution: 'manual' },
      { sku: 'NW002', name: 'Flour 1kg', brand: 'Edmonds', packSize: { qty: 1000, unit: 'g' }, price: 4.50, unitPrice: { value: 0.0045, per: 'g' }, inStock: true, onSpecial: false, cartQty: 1, resolution: 'manual' },
    ],
  }]);
  const res = await patchChosenSku('sli-1', { sku: 'NW002' });
  expect(res.status).toBe(200);
  expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({
    chosenSku: 'NW002',
    sku: 'NW002',
    name: 'Flour 1kg',
    price: '4.5',
  }));
});

it('PATCH /items/:id/chosen-sku rejects sku not in candidates', async () => {
  mocks.selectLimit.mockResolvedValueOnce([{
    candidates: [{ sku: 'NW001', name: 'Flour 1.5kg', brand: 'Pams', packSize: null, price: 3.99, unitPrice: null, inStock: true, onSpecial: false, cartQty: 1, resolution: 'sole' }],
  }]);
  const res = await patchChosenSku('sli-1', { sku: 'NW999' });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run test to watch it fail**

Run: `pnpm --filter @eat/server test -- shopping-lists.test.ts`
Expected: FAIL — endpoint doesn't exist.

- [ ] **Step 3: Implement endpoint**

In `apps/server/src/routes/shopping-lists.ts`, add (above the existing `GET /:id/prices`):

```ts
router.patch('/items/:itemId/chosen-sku', withHousehold, async (req, res) => {
  const itemId = req.params['itemId'] as string;
  if (!z.string().uuid().safeParse(itemId).success) { res.status(404).json({ error: 'Not found' }); return; }
  const { sku } = req.body as { sku?: string };
  if (typeof sku !== 'string' || sku.length === 0) { res.status(400).json({ error: 'sku required' }); return; }

  try {
    const rows = await db
      .select({ candidates: shoppingListPrices.candidates })
      .from(shoppingListPrices)
      .where(and(
        eq(shoppingListPrices.shoppingListItemId, itemId),
        eq(shoppingListPrices.store, 'new_world'),
      ))
      .limit(1);
    const row = rows[0];
    if (!row) { res.status(404).json({ error: 'No prices for this item yet' }); return; }
    const candidates = (row.candidates ?? []) as ProductCandidate[];
    const chosen = candidates.find(c => c.sku === sku);
    if (!chosen) { res.status(400).json({ error: 'sku not in candidates' }); return; }

    await db
      .update(shoppingListPrices)
      .set({
        chosenSku: chosen.sku,
        sku: chosen.sku,
        name: chosen.name,
        price: chosen.price !== null && chosen.price !== undefined ? String(chosen.price) : null,
        inStock: chosen.inStock,
        matched: true,
        checkedAt: new Date(),
      })
      .where(and(
        eq(shoppingListPrices.shoppingListItemId, itemId),
        eq(shoppingListPrices.store, 'new_world'),
      ));

    res.json({ ok: true, chosenSku: chosen.sku });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Add at the top of the file: `import type { ProductCandidate } from '@eat/shared';`

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm --filter @eat/server test -- shopping-lists.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/shopping-lists.ts apps/server/src/routes/shopping-lists.test.ts
git commit -m "feat(server): PATCH /items/:id/chosen-sku for manual candidate pick"
```

---

## Task 7: UI — state badges + manual-pick expand

**Files:**
- Create: `apps/web/src/pages/ShoppingListPage/CandidatePicker.tsx`
- Modify: `apps/web/src/hooks/useShoppingList.ts`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`

- [ ] **Step 1: Add `useChooseSku` hook (placed next to existing prices hooks)**

In `apps/web/src/hooks/usePricesForList.ts`, append:

```ts
export function useChooseSku(listId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, sku }: { itemId: string; sku: string }) =>
      api.patch<{ ok: true; chosenSku: string }>(`/api/shopping-lists/items/${itemId}/chosen-sku`, { sku }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list-prices', listId] });
    },
  });
}
```

(If `api.patch` doesn't exist in `apps/web/src/api/client.ts`, add it following the same pattern as `api.put` already in that file.)

- [ ] **Step 2: Failing tests for the badge + picker**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`, add (or extend) a test block:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// ... existing setup imports

describe('ShoppingListPage — phase 4 candidate review', () => {
  it('shows "Sole match" badge for sole-resolution items', async () => {
    // mock prices fetch to return one item with a sole-resolution candidate + chosenSku set
    // render, assert badge text
    // (use existing harness in this file for fetch mocks)
  });

  it('shows "Pick one" badge for manual-resolution items and reveals candidates on tap', async () => {
    // mock prices fetch with chosenSku=null + 3 candidates
    // render, click the row, assert 3 candidate buttons rendered
  });

  it('selecting a candidate calls PATCH chosen-sku and replaces badge with "Picked"', async () => {
    // render, click candidate, assert PATCH fired
  });
});
```

(Flesh out the bodies following the patterns in the existing tests in this file; lean on `mockApi` if present.)

- [ ] **Step 3: Run tests to watch them fail**

Run: `pnpm --filter @eat/web test -- ShoppingListPage.test.tsx`
Expected: 3 FAIL — no badge / picker exists.

- [ ] **Step 4: Implement `CandidatePicker`**

Create `apps/web/src/pages/ShoppingListPage/CandidatePicker.tsx`:

```tsx
import type { ProductCandidate } from '@eat/shared';
import './ShoppingListPage.css';

interface Props {
  candidates: ProductCandidate[];
  chosenSku: string | null;
  onPick: (sku: string) => void;
  disabled?: boolean;
}

export function CandidatePicker({ candidates, chosenSku, onPick, disabled }: Props) {
  if (candidates.length === 0) return null;
  return (
    <ul className="candidate-picker">
      {candidates.map(c => {
        const isChosen = c.sku === chosenSku;
        return (
          <li key={c.sku} className={`candidate ${isChosen ? 'chosen' : ''}`}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(c.sku)}
              aria-pressed={isChosen}
            >
              <span className="candidate-name">{c.name}</span>
              {c.brand && <span className="candidate-brand">{c.brand}</span>}
              {c.packSize && (
                <span className="candidate-pack">
                  {c.packSize.unit === 'count' ? `${c.packSize.qty} pk` : `${c.packSize.qty}${c.packSize.unit}`}
                </span>
              )}
              <span className="candidate-price">${c.price.toFixed(2)}</span>
              {c.unitPrice && (
                <span className="candidate-unit-price">
                  ${(c.unitPrice.value * 100).toFixed(2)}/100{c.unitPrice.per === 'count' ? 'ea' : c.unitPrice.per}
                </span>
              )}
              {c.onSpecial && <span className="candidate-special">SPECIAL</span>}
              {c.cartQty > 1 && <span className="candidate-multi">×{c.cartQty}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5: Wire badges + expand into ShoppingListPage**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`, the existing `usePricesForList` already returns `pricesData` (a `PricesForListResponse`). It now carries `candidates` + `chosenSku` per row (from Task 2 type extension).

Changes:

1. Rename the existing **Refresh prices** button label to **Find products** (find the line that renders the existing button, replace its child text).
2. Build a per-item lookup near the top of the render:

```tsx
import type { ShoppingListPrice } from '@eat/shared';
const pricesByItem = new Map<string, ShoppingListPrice>(
  (pricesData?.prices ?? []).map(p => [p.shoppingListItemId, p]),
);
```

3. Add the badge + expand state:

```tsx
import { useState } from 'react';
import { CandidatePicker } from './CandidatePicker';
import { useChooseSku } from '../../hooks/usePricesForList';

// inside ShoppingListPage component, near other useState calls:
const [expanded, setExpanded] = useState<Record<string, boolean>>({});
const chooseSku = useChooseSku(list.id);

function badgeFor(itemId: string): 'Sole match' | 'Preferred' | 'Picked' | 'Pick one' | null {
  const p = pricesByItem.get(itemId);
  if (!p || p.candidates.length === 0) return null;
  if (!p.chosenSku) return p.candidates.length > 1 ? 'Pick one' : null;
  const chosen = p.candidates.find(c => c.sku === p.chosenSku);
  if (!chosen) return null;
  if (chosen.resolution === 'sole') return 'Sole match';
  if (chosen.resolution === 'preferred') return 'Preferred';
  return 'Picked';
}
```

4. In the JSX where each item row is rendered (find the row map), insert after the existing name/qty cells:

```tsx
{(() => {
  const badge = badgeFor(item.id);
  const p = pricesByItem.get(item.id);
  if (!badge) return null;
  const slug = badge.toLowerCase().replace(/\s+/g, '-');
  return (
    <>
      <span className={`row-badge row-badge-${slug}`}>{badge}</span>
      {badge === 'Pick one' && (
        <button
          type="button"
          className="row-toggle"
          onClick={() => setExpanded(e => ({ ...e, [item.id]: !e[item.id] }))}
        >
          {expanded[item.id] ? 'Hide options' : 'Show options'}
        </button>
      )}
      {badge === 'Pick one' && expanded[item.id] && p && (
        <CandidatePicker
          candidates={p.candidates}
          chosenSku={p.chosenSku}
          disabled={chooseSku.isPending}
          onPick={sku => chooseSku.mutate({ itemId: item.id, sku })}
        />
      )}
    </>
  );
})()}
```

(If the existing row layout is a table-row, render the badge in a new `<td>` and the picker in a full-width `<tr>` below; if it's flex/grid, just add them after the existing nodes.)

- [ ] **Step 6: Styles**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`, append:

```css
.row-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}
.row-badge-sole-match  { background: var(--color-bg-success);  color: var(--color-fg-success); }
.row-badge-preferred   { background: var(--color-bg-info);     color: var(--color-fg-info); }
.row-badge-picked      { background: var(--color-bg-info);     color: var(--color-fg-info); }
.row-badge-pick-one    { background: var(--color-bg-warning);  color: var(--color-fg-warning); }
.candidate-picker { list-style: none; padding: 0; margin: 8px 0; display: grid; gap: 6px; }
.candidate button {
  display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
  width: 100%; text-align: left; padding: 8px; border: 1px solid var(--color-border); border-radius: 8px;
  background: var(--color-bg-surface);
}
.candidate.chosen button { border-color: var(--color-fg-info); }
.candidate-special { color: var(--color-fg-warning); font-weight: 600; }
.candidate-unit-price { color: var(--color-fg-muted); font-size: 12px; }
```

(If your token names differ, follow the existing variable conventions in the same CSS file.)

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @eat/web test -- ShoppingListPage.test.tsx`
Expected: PASS for all 3 new tests + all existing ones.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage apps/web/src/hooks/useShoppingList.ts
git commit -m "feat(web): state badges + candidate picker for shopping list rows"
```

---

## Task 8: Scraper — parseTrolley + diff logic

**Files:**
- Create: `apps/scraper/src/stores/newworld-trolley.fixture.html` (small HTML fixture)
- Modify: `apps/scraper/src/stores/newworld.ts` — `parseTrolley` + `diffTrolley`
- Modify: `apps/scraper/src/stores/newworld.test.ts`

- [ ] **Step 1: Create trolley HTML fixture**

Create `apps/scraper/src/stores/newworld-trolley.fixture.html`:

```html
<section data-testid="trolley">
  <ul>
    <li data-product-id="NW001"><span data-testid="trolley-qty">1</span><span class="trolley-name">Flour 1.5kg</span></li>
    <li data-product-id="NW002"><span data-testid="trolley-qty">2</span><span class="trolley-name">Milk 2L</span></li>
  </ul>
</section>
```

- [ ] **Step 2: Failing tests for parseTrolley + diffTrolley**

Append to `apps/scraper/src/stores/newworld.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseTrolley, diffTrolley } from './newworld.js';

describe('parseTrolley', () => {
  it('parses sku + qty pairs from trolley HTML', () => {
    const html = readFileSync(resolve(__dirname, 'newworld-trolley.fixture.html'), 'utf8');
    const out = parseTrolley(html);
    expect(out).toEqual([
      { sku: 'NW001', qty: 1 },
      { sku: 'NW002', qty: 2 },
    ]);
  });

  it('returns [] for an empty trolley', () => {
    expect(parseTrolley('<section data-testid="trolley"><ul></ul></section>')).toEqual([]);
  });
});

describe('diffTrolley', () => {
  const trolley = [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 2 }];

  it('returns add for missing skus', () => {
    expect(diffTrolley(trolley, [{ sku: 'C', qty: 1 }])).toEqual([{ sku: 'C', qty: 1, action: 'add' }]);
  });

  it('returns bump when requested qty exceeds present qty', () => {
    expect(diffTrolley(trolley, [{ sku: 'A', qty: 3 }])).toEqual([{ sku: 'A', qty: 3, action: 'bump' }]);
  });

  it('returns skip when present qty already covers requested', () => {
    expect(diffTrolley(trolley, [{ sku: 'B', qty: 2 }])).toEqual([{ sku: 'B', qty: 2, action: 'skip' }]);
    expect(diffTrolley(trolley, [{ sku: 'B', qty: 1 }])).toEqual([{ sku: 'B', qty: 1, action: 'skip' }]);
  });
});
```

- [ ] **Step 3: Run failing tests**

Run: `pnpm --filter @eat/scraper test -- newworld.test.ts`
Expected: FAIL — `parseTrolley` and `diffTrolley` not exported.

- [ ] **Step 4: Implement parseTrolley and diffTrolley**

Append to `apps/scraper/src/stores/newworld.ts`:

```ts
export interface TrolleyLine { sku: string; qty: number; }
export interface TrolleyDiffAction { sku: string; qty: number; action: 'add' | 'bump' | 'skip'; }

export function parseTrolley(html: string): TrolleyLine[] {
  const $ = cheerio.load(html);
  const out: TrolleyLine[] = [];
  $('section[data-testid="trolley"] li[data-product-id]').each((_i, el) => {
    const $el = $(el);
    const sku = $el.attr('data-product-id') ?? '';
    const qtyText = $el.find('[data-testid="trolley-qty"]').first().text().trim();
    const qty = parseInt(qtyText, 10);
    if (sku && !Number.isNaN(qty)) out.push({ sku, qty });
  });
  return out;
}

export function diffTrolley(
  trolley: TrolleyLine[],
  requested: TrolleyLine[],
): TrolleyDiffAction[] {
  const byKey = new Map(trolley.map(t => [t.sku, t.qty] as const));
  return requested.map(r => {
    const have = byKey.get(r.sku);
    if (have === undefined) return { sku: r.sku, qty: r.qty, action: 'add' as const };
    if (have < r.qty) return { sku: r.sku, qty: r.qty, action: 'bump' as const };
    return { sku: r.sku, qty: r.qty, action: 'skip' as const };
  });
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm --filter @eat/scraper test -- newworld.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/scraper/src/stores/newworld.ts apps/scraper/src/stores/newworld.test.ts apps/scraper/src/stores/newworld-trolley.fixture.html
git commit -m "feat(scraper): parseTrolley + diffTrolley for idempotent cart writes"
```

---

## Task 9: Scraper — `add_to_cart` adapter method

**Files:**
- Modify: `apps/scraper/src/worker-sdk/types.ts`
- Modify: `apps/scraper/src/stores/newworld.ts`
- Modify: `apps/scraper/src/stores/newworld.test.ts`

- [ ] **Step 1: Add `'add_to_cart'` to JobType**

Edit `apps/scraper/src/worker-sdk/types.ts`:

```ts
export type JobType = 'import_past_orders' | 'compare_prices' | 'add_to_cart';
```

- [ ] **Step 2: Failing test for the unit-testable parts of the handler**

The cart-write involves Playwright navigation which is awkward to unit-test fully — we cover the diff plumbing and result shape here, and lean on the smoke run in Task 13 for end-to-end. Add to `apps/scraper/src/stores/newworld.test.ts`:

```ts
import { buildCartResultFromActions } from './newworld.js';

describe('buildCartResultFromActions', () => {
  it('maps diff actions + per-attempt outcomes to CartActionResult[]', () => {
    const actions = [
      { sku: 'A', qty: 1, action: 'add' as const },
      { sku: 'B', qty: 2, action: 'bump' as const },
      { sku: 'C', qty: 1, action: 'skip' as const },
      { sku: 'D', qty: 1, action: 'add' as const },
    ];
    const attempts = new Map([
      ['A', { ok: true }],
      ['B', { ok: true }],
      ['D', { ok: false, reason: 'out_of_stock' }],
    ]);
    const skuToItem = new Map([
      ['A', 'sli-a'], ['B', 'sli-b'], ['C', 'sli-c'], ['D', 'sli-d'],
    ]);
    const out = buildCartResultFromActions(actions, attempts, skuToItem);
    expect(out).toEqual([
      { shoppingListItemId: 'sli-a', sku: 'A', requestedQty: 1, action: 'added' },
      { shoppingListItemId: 'sli-b', sku: 'B', requestedQty: 2, action: 'qty_increased' },
      { shoppingListItemId: 'sli-c', sku: 'C', requestedQty: 1, action: 'already_in_cart' },
      { shoppingListItemId: 'sli-d', sku: 'D', requestedQty: 1, action: 'failed', failureReason: 'out_of_stock' },
    ]);
  });
});
```

- [ ] **Step 3: Run test to watch it fail**

Run: `pnpm --filter @eat/scraper test -- newworld.test.ts`
Expected: FAIL — `buildCartResultFromActions` not exported.

- [ ] **Step 4: Implement helper and adapter branch**

In `apps/scraper/src/stores/newworld.ts`, add (above `newWorldAdapter`):

```ts
import type { CartActionResult, CartJobResult } from '@eat/shared';

export function buildCartResultFromActions(
  actions: TrolleyDiffAction[],
  attempts: Map<string, { ok: boolean; reason?: string }>,
  skuToShoppingListItemId: Map<string, string>,
): CartActionResult[] {
  return actions.map(a => {
    const itemId = skuToShoppingListItemId.get(a.sku) ?? a.sku;
    if (a.action === 'skip') {
      return { shoppingListItemId: itemId, sku: a.sku, requestedQty: a.qty, action: 'already_in_cart' };
    }
    const att = attempts.get(a.sku);
    if (att?.ok) {
      return {
        shoppingListItemId: itemId, sku: a.sku, requestedQty: a.qty,
        action: a.action === 'add' ? 'added' : 'qty_increased',
      };
    }
    return {
      shoppingListItemId: itemId, sku: a.sku, requestedQty: a.qty,
      action: 'failed', failureReason: att?.reason ?? 'unknown',
    };
  });
}

const TROLLEY_URL = 'https://www.newworld.co.nz/shop/trolley';
const PRODUCT_URL = (sku: string) => `https://www.newworld.co.nz/shop/product/${sku}`;

interface AddToCartPayload {
  shoppingListId: string;
  items: Array<{ shoppingListItemId: string; sku: string; qty: number }>;
}

async function handleAddToCart(job: ScraperJob, browser: Browser): Promise<JobResult> {
  const storageState = await loadStorageState(job.householdId, 'new_world');
  if (!storageState) return { ok: false, error: 'no_session' };

  const payload = job.payload as AddToCartPayload | null;
  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    return { ok: false, error: 'invalid_payload' };
  }

  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  try {
    // 1) Read trolley
    await page.goto(TROLLEY_URL, { waitUntil: 'domcontentloaded' });
    let html = await page.content();
    if (isLoggedOutPage(html)) return { ok: false, error: 'session_expired' };
    const trolley = parseTrolley(html);

    // 2) Diff
    const requested = payload.items.map(i => ({ sku: i.sku, qty: i.qty }));
    const actions = diffTrolley(trolley, requested);

    // 3) Apply add / bump actions
    const attempts = new Map<string, { ok: boolean; reason?: string }>();
    for (const a of actions) {
      if (a.action === 'skip') continue;
      try {
        await page.goto(PRODUCT_URL(a.sku), { waitUntil: 'domcontentloaded' });
        const qtyInput = page.locator('input[data-testid="qty-input"]');
        await qtyInput.waitFor({ timeout: 5000 });
        await qtyInput.fill(String(a.qty));
        const addBtn = page.locator('button[data-testid="add-to-trolley"]');
        await addBtn.click();
        await page.locator('[data-testid="trolley-count-badge"]').waitFor({ timeout: 3000 });
        attempts.set(a.sku, { ok: true });
      } catch (err) {
        const reason = err instanceof Error && /selector|timeout/i.test(err.message)
          ? 'product_unavailable'
          : (err instanceof Error ? err.message : 'unknown');
        attempts.set(a.sku, { ok: false, reason });
      }
      await page.waitForTimeout(700); // throttle
    }

    // 4) Read trolley back
    await page.goto(TROLLEY_URL, { waitUntil: 'domcontentloaded' });
    html = await page.content();
    const $ = cheerio.load(html);
    const totalText = $('[data-testid="trolley-total"]').first().text().trim();
    const cartTotalNzd = parseFloat(totalText.replace(/[^0-9.]/g, '')) || 0;

    const skuToItem = new Map(payload.items.map(i => [i.sku, i.shoppingListItemId] as const));
    const result: CartJobResult = {
      perItem: buildCartResultFromActions(actions, attempts, skuToItem),
      cartTotalNzd,
      trolleyUrl: TROLLEY_URL,
    };
    return { ok: true, data: result as unknown as Record<string, unknown> };
  } finally {
    await context.close();
  }
}
```

In the existing `newWorldAdapter.handle()`, add the dispatch:

```ts
if (job.type === 'add_to_cart') {
  return handleAddToCart(job, browser);
}
```

(Inside the existing `try` block, before the final `unknown_type` fallthrough.)

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @eat/scraper test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/scraper
git commit -m "feat(scraper): add_to_cart handler diffs trolley then applies via product pages"
```

---

## Task 10: Server — send-to-cart enqueue + cart-result endpoint + job lifecycle plumbing

**Files:**
- Modify: `apps/server/src/routes/scraper.ts`
- Modify: `apps/server/src/routes/shopping-lists.ts`
- Modify: `apps/server/src/routes/shopping-lists.test.ts`
- Modify: `apps/server/src/routes/scraper.test.ts`

- [ ] **Step 1: Failing test — send-to-cart enqueue**

In `apps/server/src/routes/shopping-lists.test.ts`:

```ts
it('POST /:id/send-to-cart enqueues add_to_cart with items that have chosenSku', async () => {
  mocks.selectFrom.mockResolvedValueOnce([
    {
      shoppingListItemId: 'sli-1',
      candidates: [{ sku: 'NW001', cartQty: 1, name: 'X', brand: null, packSize: null, price: 1.99, unitPrice: null, inStock: true, onSpecial: false, resolution: 'sole' }],
      chosenSku: 'NW001',
    },
    {
      shoppingListItemId: 'sli-2',
      candidates: [{ sku: 'NW002', cartQty: 2, name: 'Y', brand: null, packSize: null, price: 2.50, unitPrice: null, inStock: true, onSpecial: false, resolution: 'sole' }],
      chosenSku: 'NW002',
    },
    { shoppingListItemId: 'sli-3', candidates: [], chosenSku: null }, // skipped
  ]);
  mocks.insertValues.mockResolvedValueOnce([{ id: 'job-9' }]);
  const res = await postSendToCart('LIST-1');
  expect(res.status).toBe(200);
  expect(res.body.jobId).toBe('job-9');
  expect(res.body.skipped).toEqual(['sli-3']);
  expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({
    type: 'add_to_cart',
    payload: expect.objectContaining({
      items: [
        { shoppingListItemId: 'sli-1', sku: 'NW001', qty: 1 },
        { shoppingListItemId: 'sli-2', sku: 'NW002', qty: 2 },
      ],
    }),
  }));
});
```

- [ ] **Step 2: Run test to watch it fail**

Run: `pnpm --filter @eat/server test -- shopping-lists.test.ts`
Expected: FAIL — endpoint missing.

- [ ] **Step 3: Implement `POST /:id/send-to-cart` + `GET /:id/cart-result`**

In `apps/server/src/routes/shopping-lists.ts`, after the existing `POST /:id/refresh-prices`:

```ts
router.post('/:id/send-to-cart', withHousehold, async (req, res) => {
  const listId = req.params['id'] as string;
  if (!z.string().uuid().safeParse(listId).success) { res.status(404).json({ error: 'Not found' }); return; }
  try {
    const rows = await db
      .select({
        shoppingListItemId: shoppingListPrices.shoppingListItemId,
        chosenSku: shoppingListPrices.chosenSku,
        candidates: shoppingListPrices.candidates,
      })
      .from(shoppingListPrices)
      .innerJoin(shoppingListItems, eq(shoppingListPrices.shoppingListItemId, shoppingListItems.id))
      .where(and(
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListPrices.store, 'new_world'),
      ));

    const sendable: Array<{ shoppingListItemId: string; sku: string; qty: number }> = [];
    const skipped: string[] = [];
    for (const r of rows) {
      if (!r.chosenSku) { skipped.push(r.shoppingListItemId); continue; }
      const cands = (r.candidates ?? []) as ProductCandidate[];
      const c = cands.find(x => x.sku === r.chosenSku);
      if (!c) { skipped.push(r.shoppingListItemId); continue; }
      sendable.push({ shoppingListItemId: r.shoppingListItemId, sku: c.sku, qty: c.cartQty });
    }
    if (sendable.length === 0) { res.status(400).json({ error: 'No items with a chosen sku' }); return; }

    const inserted = await db
      .insert(scraperJobs)
      .values({
        householdId: req.householdId,
        store: 'new_world',
        type: 'add_to_cart',
        payload: { shoppingListId: listId, items: sendable },
        status: 'pending',
      })
      .returning({ id: scraperJobs.id });

    res.json({ jobId: inserted[0]?.id, skipped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/cart-result', withHousehold, async (req, res) => {
  const listId = req.params['id'] as string;
  if (!z.string().uuid().safeParse(listId).success) { res.json({ result: null }); return; }
  try {
    const rows = await db
      .select({ id: scraperJobs.id, status: scraperJobs.status, result: scraperJobs.result, error: scraperJobs.error })
      .from(scraperJobs)
      .where(and(eq(scraperJobs.householdId, req.householdId), eq(scraperJobs.type, 'add_to_cart')))
      .orderBy(desc(scraperJobs.createdAt))
      .limit(5);
    const job = rows.find(r => {
      const p = (r as Record<string, unknown>)['payload'] as Record<string, unknown> | undefined;
      return p && p['shoppingListId'] === listId;
    }) ?? rows[0] ?? null;
    res.json({
      job: job ? { id: job.id, status: job.status, error: job.error } : null,
      result: job?.result ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Make sure `import type { ProductCandidate } from '@eat/shared';` is present at the top.

- [ ] **Step 4: Extend the worker result handler in scraper.ts**

In `apps/server/src/routes/scraper.ts`, in `POST /jobs/:id/result`, add the dispatch for `add_to_cart`:

```ts
if (job.type === 'compare_prices') {
  await applyComparePricesResult(job.store, data);
} else if (job.type === 'import_past_orders') {
  await applyImportPastOrdersResult(job.householdId, job.store, data);
} else if (job.type === 'add_to_cart') {
  // No DB writes beyond the job row itself — the job.result captures the per-item action breakdown
  // and the user-facing reconcile reads it back via GET /api/shopping-lists/:id/cart-result.
}
```

(Leaving the branch in even though it's a no-op makes the intent explicit and gives a clear hook if we later want to mirror per-item action onto `shopping_list_prices`.)

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @eat/server test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "feat(server): send-to-cart enqueue + cart-result endpoints"
```

---

## Task 11: Web — send-to-cart button + reconcile modal

**Files:**
- Modify: `apps/web/src/hooks/useShoppingList.ts`
- Create: `apps/web/src/pages/ShoppingListPage/ReconcileModal.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`

- [ ] **Step 1: Add `useSendToCart` and `useCartResult` hooks**

Append to `apps/web/src/hooks/usePricesForList.ts`:

```ts
import type { SendToCartResponse, CartResultResponse } from '@eat/shared';

export function useSendToCart(listId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SendToCartResponse>(`/api/shopping-lists/${listId}/send-to-cart`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list-cart-result', listId] }),
  });
}

export function useCartResult(listId: string | null | undefined, opts?: { pollMs?: number }) {
  return useQuery<CartResultResponse>({
    queryKey: ['shopping-list-cart-result', listId],
    queryFn: () => api.get<CartResultResponse>(`/api/shopping-lists/${listId}/cart-result`),
    enabled: !!listId,
    refetchInterval: query => {
      const status = query.state.data?.job?.status;
      return status === 'pending' || status === 'in_progress' ? (opts?.pollMs ?? 4000) : false;
    },
  });
}
```

- [ ] **Step 2: Failing tests**

In `ShoppingListPage.test.tsx`:

```tsx
describe('ShoppingListPage — send to cart', () => {
  it('Send to cart button is disabled while a manual pick is outstanding', async () => {
    // mock prices with a manual-resolution item, chosenSku null
    // assert button.disabled === true
  });

  it('clicking Send to cart enqueues the job and opens the reconcile modal on completion', async () => {
    // mock the POST then sequenced GETs for cart-result (pending → done)
    // assert modal renders with perItem rows + trolley link
  });
});
```

Flesh out the bodies following existing patterns in this file.

- [ ] **Step 3: Run failing tests**

Run: `pnpm --filter @eat/web test -- ShoppingListPage.test.tsx`
Expected: FAIL — button + modal don't exist.

- [ ] **Step 4: Implement `ReconcileModal`**

Create `apps/web/src/pages/ShoppingListPage/ReconcileModal.tsx`:

```tsx
import type { CartJobResult, CartActionResult } from '@eat/shared';

interface Props {
  open: boolean;
  onClose: () => void;
  result: CartJobResult | null;
  items: Array<{ id: string; name: string }>;
}

const ACTION_LABEL: Record<CartActionResult['action'], string> = {
  added: 'Added',
  qty_increased: 'Qty bumped',
  already_in_cart: 'Already in cart',
  failed: 'Failed',
};

export function ReconcileModal({ open, onClose, result, items }: Props) {
  if (!open) return null;
  const nameById = new Map(items.map(i => [i.id, i.name]));
  return (
    <div className="reconcile-modal" role="dialog" aria-modal="true">
      <div className="reconcile-modal-inner">
        <header><h2>Cart updated</h2><button onClick={onClose}>Close</button></header>
        {!result && <p>Waiting for cart…</p>}
        {result && (
          <>
            <ul className="reconcile-list">
              {result.perItem.map(r => (
                <li key={r.shoppingListItemId + r.sku} className={`reconcile-row reconcile-${r.action}`}>
                  <span className="reconcile-name">{nameById.get(r.shoppingListItemId) ?? r.sku}</span>
                  <span className="reconcile-action">{ACTION_LABEL[r.action]}</span>
                  {r.failureReason && <span className="reconcile-reason">{r.failureReason}</span>}
                </li>
              ))}
            </ul>
            <footer>
              <span>Trolley total: ${result.cartTotalNzd.toFixed(2)}</span>
              <a href={result.trolleyUrl} target="_blank" rel="noreferrer">Open New World trolley →</a>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire Send to cart + modal into ShoppingListPage**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useSendToCart, useCartResult } from '../../hooks/usePricesForList';
import { ReconcileModal } from './ReconcileModal';

// inside the component (`pricesByItem` already built in Task 7 step 5):
const sendToCart = useSendToCart(list.id);
const cartResult = useCartResult(list.id);
const [reconcileOpen, setReconcileOpen] = useState(false);

const items = list.items; // existing variable from the prior render code
const hasUnpicked = items.some(it => {
  const p = pricesByItem.get(it.id);
  return p ? (p.candidates.length > 1 && !p.chosenSku) : false;
});
const hasAnyPicked = items.some(it => !!pricesByItem.get(it.id)?.chosenSku);

useEffect(() => {
  if (cartResult.data?.job?.status === 'done') setReconcileOpen(true);
}, [cartResult.data?.job?.status]);

// render near the existing top buttons:
<button
  type="button"
  disabled={!hasAnyPicked || hasUnpicked || sendToCart.isPending}
  onClick={() => sendToCart.mutate()}
>
  {sendToCart.isPending ? 'Sending…' : 'Send to cart'}
</button>
{hasUnpicked && <span className="hint">Pick options for items marked “Pick one” first.</span>}

<ReconcileModal
  open={reconcileOpen}
  onClose={() => setReconcileOpen(false)}
  result={cartResult.data?.result ?? null}
  items={items.map(i => ({ id: i.id, name: i.name }))}
/>
```

- [ ] **Step 6: Styles**

Append to `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`:

```css
.reconcile-modal {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 50;
}
.reconcile-modal-inner {
  background: var(--color-bg-surface); border-radius: 12px; max-width: 480px; width: 90%; padding: 16px; max-height: 80vh; overflow: auto;
}
.reconcile-list { list-style: none; padding: 0; }
.reconcile-row { display: flex; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--color-border); }
.reconcile-failed .reconcile-action { color: var(--color-fg-error); }
.reconcile-already_in_cart .reconcile-action { color: var(--color-fg-muted); }
.hint { font-size: 12px; color: var(--color-fg-muted); margin-left: 8px; }
```

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @eat/web test -- ShoppingListPage.test.tsx`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): send-to-cart button + reconcile modal"
```

---

## Task 12: E2E smoke for app + unit/E2E full pass

**Files:**
- Modify: `apps/web/e2e/shopping-list.spec.ts` (or whichever spec covers the shopping list)

- [ ] **Step 1: Add E2E coverage for the new flow**

Find the existing shopping-list E2E in `apps/web/e2e/`. Extend it to:

1. Mock `GET /api/shopping-lists/:id/prices` to return one row with a `manual` resolution + 2 candidates + chosenSku null, and another with a `sole` resolution + chosenSku set.
2. Assert the "Pick one" badge renders for row 1 and "Sole match" for row 2.
3. Click "Show options" on row 1, click the first candidate, assert PATCH fired.
4. Assert "Send to cart" becomes enabled, click it.
5. Mock `GET /api/shopping-lists/:id/cart-result` to return `{ job: { status: 'done' }, result: { perItem: […], cartTotalNzd: 12.34, trolleyUrl: 'https://www.newworld.co.nz/shop/trolley' } }` after a tick.
6. Assert reconcile modal renders with the perItem rows + trolley link.

Use Playwright's `page.route(...)` to intercept the API calls.

- [ ] **Step 2: Full unit suite + full E2E (mandatory per CLAUDE.md)**

Run:

```bash
pnpm test
pnpm test:e2e
```

Expected: both green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e
git commit -m "test(web): e2e coverage for find products + manual pick + send to cart"
```

---

## Task 13: Smoke test against live New World

**Files:**
- Modify: `apps/scraper/src/smoke/newworld.ts`

- [ ] **Step 1: Add a `cart` mode to the smoke script**

Edit `apps/scraper/src/smoke/newworld.ts`. The file currently handles `search` / `past-orders` smoke; add a third arg-driven mode:

```ts
if (mode === 'cart') {
  // Pick a single tiny non-perishable SKU (set via env, fallback to a known canister/pantry SKU you've verified)
  const sku = process.env.SMOKE_NW_SKU ?? '5037021'; // example placeholder; user supplies real
  const itemPayload = {
    shoppingListId: 'smoke-list',
    items: [{ shoppingListItemId: 'smoke-item', sku, qty: 1 }],
  };
  const job: ScraperJob = {
    id: 'smoke-cart',
    householdId: process.env.SMOKE_HOUSEHOLD_ID!,
    store: 'new_world',
    type: 'add_to_cart',
    payload: itemPayload,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  const browser = await chromium.launch({ headless: true });
  const result = await newWorldAdapter.handle(job, browser);
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  return;
}
```

- [ ] **Step 2: Run smoke (manual — not in CI)**

This step is **manual** and requires:

- The Mac mini has a valid `new_world` session (re-run `pnpm bootstrap:newworld` if not).
- `SMOKE_HOUSEHOLD_ID` and `SMOKE_NW_SKU` are set in the env.

Run:

```bash
pnpm --filter @eat/scraper exec tsx src/smoke/newworld.ts cart
```

Expected: a JSON result with `ok: true`, `perItem` containing one row with action `added` or `already_in_cart`, and a non-zero `cartTotalNzd`. Verify the item is actually in the live NW trolley by checking the web UI.

- [ ] **Step 3: Re-run for idempotency**

Run the same command again immediately. Expected: `perItem[0].action === 'already_in_cart'`, trolley unchanged. This verifies the diff logic is idempotent.

- [ ] **Step 4: Commit (smoke script change only — no test asserts)**

```bash
git add apps/scraper/src/smoke/newworld.ts
git commit -m "chore(scraper): cart smoke mode for live NW verification"
```

---

## Task 14: Update PLAN.md and DECISIONS.md

**Files:**
- Modify: `PLAN.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Move Phase 4 items to Done in PLAN.md**

In `PLAN.md`, under `## Phase 4 — Build-to-cart (New World only)`, flip the four items to `[x]` with the date `_2026-05-18_` (or the actual completion date). Update `**Currently on:**` near the top to reflect the next active phase (likely back to slice-2 hardening or whatever the user wants next).

Add an entry to the **Done** log at the bottom:

```
- 2026-05-18 — Phase 4: build-to-cart (New World only) shipped. compare_prices now returns top-N candidates with sole/preferred/manual resolutions; shopping list UI shows state badges + per-row candidate picker; new add_to_cart job diffs the live trolley (idempotent), applies via product detail pages, returns a per-item action breakdown + cart total; reconcile modal surfaces the result with an "Open New World trolley" link. See D23 and docs/superpowers/specs/2026-05-17-phase4-build-to-cart-design.md.
```

- [ ] **Step 2: Add D23 to DECISIONS.md**

Append to `DECISIONS.md`:

```
## D23 — Phase 4 build-to-cart implementation: top-N candidates + per-item review + diff-style cart writes
**Date:** 2026-05-18
**Decision:**
- Reshape `compare_prices` to return top-N (default 5) `ProductCandidate[]` per item, ranked by per-100g/ml unit price among packs that meet the recipe's required qty (multiplier ≥ 1 when no single pack is big enough). Three resolutions: `sole` (one viable candidate), `preferred` (preferred brand wins in top 3), `manual` (multiple plausible, no preferred). Specials are decoration, not ranking.
- Persist candidates + chosenSku on `shopping_list_prices` (already per-item, per-store) — not on `shopping_list_items` — so multi-store cart builds later inherit the shape cleanly.
- Two-job pipeline: `compare_prices` → user reviews and (for manual items) picks → `add_to_cart`. The one-button collapsed UX (Approach B in the spec) is deferred; it builds on the same primitives.
- `add_to_cart` diffs against the live trolley before writing → idempotent under retry, safe to re-run.
- Detailed result JSON on `scraper_jobs` (no new audit table). Reconcile view reads it back via a dedicated endpoint.

**Rationale:** Two-job pipeline is the simplest debuggable shape; each job has its own row + result JSON, and the user can resume work between steps. Per-100g/ml ranking matches how the user actually buys (cheapest per unit volume / weight, given a pack big enough to cover the recipe). Diff-against-trolley turns retries into no-ops, the safest property for a write that crosses an external service.
```

- [ ] **Step 3: Commit**

```bash
git add PLAN.md DECISIONS.md
git commit -m "docs: phase 4 done; D23 captures build-to-cart implementation"
```

---

## Final verification

- [ ] **Run the full test suite from the repo root**

```bash
pnpm test && pnpm test:e2e
```

Expected: both green.

- [ ] **Manual UX sanity check (per CLAUDE.md "For UI or frontend changes, start the dev server and use the feature in a browser")**

Run: `pnpm --filter @eat/web dev` and visit `localhost:5173/shopping`. Walk through: existing list → click **Find products** → wait for badges → click **Show options** on a "Pick one" → pick → verify "Picked" badge → click **Send to cart** → verify reconcile modal → click **Open New World trolley** (should open NW in new tab). Mock data is fine if the live scraper isn't accessible from this dev session; the goal is to confirm the UI states render cleanly.

- [ ] **Live smoke against NW** (already covered in Task 13 — re-run if any flow changed since)

Done.
