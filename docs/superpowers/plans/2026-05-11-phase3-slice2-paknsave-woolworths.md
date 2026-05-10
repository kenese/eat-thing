# Phase 3 Slice 2 — Pak'nSave + Woolworths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new store adapters (Pak'nSave, Woolworths) to the scraper, each following the slice-1 New World pattern: parsers + handle() + bootstrap login + smoke command. Smoke-only run path; no app changes.

**Architecture:** Approach A from the spec (clone-and-tweak). Each adapter is a self-contained ~130-line file with its own URL constants, selectors, parser functions, and dispatch. No shared-orchestration refactor. Fixtures live as HTML files in `apps/scraper/test/fixtures/<store>/` and are read by the test files via `fs.readFileSync`.

**Tech Stack:** TypeScript · Cheerio (HTML parsing) · Playwright (headed bootstrap + headless smoke) · Vitest (unit tests) · pnpm workspaces.

**Reference:** `docs/superpowers/specs/2026-05-11-phase3-slice2-paknsave-woolworths-design.md`

---

## Task 1: Pak'nSave fixtures

**Files:**
- Create: `apps/scraper/test/fixtures/paknsave/search.html`
- Create: `apps/scraper/test/fixtures/paknsave/orders.html`
- Create: `apps/scraper/test/fixtures/paknsave/logged-out.html`
- Create: `apps/scraper/test/fixtures/paknsave/README.md`

- [ ] **Step 1: Create the fixtures directory and search.html**

```html
<!doctype html>
<html><body>
  <main>
    <ul data-testid="product-grid">
      <li data-product-id="PN-001" data-in-stock="true">
        <h3 class="product-name">Free Range Eggs Size 7 (12 pk)</h3>
        <span class="product-brand">Mainland</span>
        <span class="product-price">$6.99</span>
      </li>
      <li data-product-id="PN-002" data-in-stock="true">
        <h3 class="product-name">Cage Eggs Size 6 (10 pk)</h3>
        <span class="product-brand">Pams</span>
        <span class="product-price">$4.49</span>
      </li>
      <li data-product-id="PN-003" data-in-stock="false">
        <h3 class="product-name">Organic Eggs (6 pk)</h3>
        <span class="product-brand">Henergy</span>
        <span class="product-price">$8.49</span>
      </li>
    </ul>
  </main>
</body></html>
```

- [ ] **Step 2: Create orders.html**

```html
<!doctype html>
<html><body>
  <main>
    <section data-testid="past-orders">
      <article class="order">
        <ul class="order-items">
          <li data-product-id="PN-001">
            <span class="item-name">Free Range Eggs Size 7 (12 pk)</span>
            <span class="item-brand">Mainland</span>
          </li>
          <li data-product-id="PN-100">
            <span class="item-name">Trim Milk 2L</span>
            <span class="item-brand">Pams</span>
          </li>
        </ul>
      </article>
      <article class="order">
        <ul class="order-items">
          <li data-product-id="PN-100">
            <span class="item-name">Trim Milk 2L</span>
            <span class="item-brand">Pams</span>
          </li>
        </ul>
      </article>
    </section>
  </main>
</body></html>
```

- [ ] **Step 3: Create logged-out.html**

```html
<!doctype html>
<html><body>
  <main>
    <div data-testid="login-required">
      <a href="/login">Sign in to see your orders</a>
    </div>
  </main>
</body></html>
```

- [ ] **Step 4: Create README.md**

```markdown
# Pak'nSave fixtures

Hand-rolled HTML mirroring the parsing surface used by the adapter
(`apps/scraper/src/stores/paknsave.ts`). Selectors:

- Search results: `ul[data-testid="product-grid"] > li[data-product-id]`
  with `.product-name`, `.product-brand`, `.product-price`,
  `data-in-stock="true"|"false"`.
- Past orders: `section[data-testid="past-orders"] li[data-product-id]`
  with `.item-name`, `.item-brand`.
- Logged-out marker: `div[data-testid="login-required"]`.

## Refreshing against the live site

When the smoke test fails because Pak'nSave ships markup changes:

1. Run `pnpm --filter @eat/scraper bootstrap:paknsave` and log in.
2. Navigate to search and orders pages, copy outerHTML via dev tools.
3. Update the parser in `paknsave.ts` to handle the new structure.
4. Replace the fixtures here with trimmed versions (drop nav chrome,
   keep the structures the parser reads).
5. Re-run `pnpm --filter @eat/scraper test`.
```

---

## Task 2: Pak'nSave failing parser test

**Files:**
- Create: `apps/scraper/src/stores/paknsave.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSearchResults, parsePastOrders, isLoggedOutPage } from './paknsave.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', '..', 'test', 'fixtures', 'paknsave');
const fixture = (name: string) => readFileSync(join(fixturesDir, name), 'utf8');

describe('parseSearchResults', () => {
  it('extracts sku, name, brand, price, in-stock', () => {
    const results = parseSearchResults(fixture('search.html'));
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      sku: 'PN-001',
      name: 'Free Range Eggs Size 7 (12 pk)',
      brand: 'Mainland',
      price: 6.99,
      inStock: true,
    });
    expect(results[2]?.inStock).toBe(false);
  });
});

describe('parsePastOrders', () => {
  it('deduplicates products across orders and counts frequency', () => {
    const products = parsePastOrders(fixture('orders.html'));
    expect(products).toHaveLength(2);
    const milk = products.find(p => p.sku === 'PN-100');
    expect(milk?.brand).toBe('Pams');
    expect(milk?.timesPurchased).toBe(2);
  });
});

describe('isLoggedOutPage', () => {
  it('returns true for the login-required marker', () => {
    expect(isLoggedOutPage(fixture('logged-out.html'))).toBe(true);
  });
  it('returns false for normal pages', () => {
    expect(isLoggedOutPage(fixture('search.html'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @eat/scraper test -- paknsave`
Expected: FAIL — `parseSearchResults`, `parsePastOrders`, `isLoggedOutPage` are not exported by the current stub.

---

## Task 3: Pak'nSave full adapter implementation

**Files:**
- Modify (replace stub): `apps/scraper/src/stores/paknsave.ts`

- [ ] **Step 1: Replace the entire file contents**

```typescript
import * as cheerio from 'cheerio';
import type { Browser } from 'playwright';
import type { JobResult, ScraperJob } from '../worker-sdk/types.js';
import type { StoreAdapter } from './base.js';
import { loadStorageState } from '../session.js';
import { pickMatch } from './match.js';

export interface ParsedSearchResult {
  sku: string;
  name: string;
  brand: string | null;
  price: number;
  inStock: boolean;
}

export interface ParsedPastOrderProduct {
  sku: string;
  name: string;
  brand: string | null;
  timesPurchased: number;
}

export function parseSearchResults(html: string): ParsedSearchResult[] {
  const $ = cheerio.load(html);
  const out: ParsedSearchResult[] = [];
  $('ul[data-testid="product-grid"] > li[data-product-id]').each((_i, el) => {
    const $el = $(el);
    const sku = $el.attr('data-product-id') ?? '';
    const name = $el.find('.product-name').first().text().trim();
    const brand = $el.find('.product-brand').first().text().trim() || null;
    const priceText = $el.find('.product-price').first().text().trim().replace(/[^0-9.]/g, '');
    const price = parseFloat(priceText);
    const inStock = $el.attr('data-in-stock') === 'true';
    if (sku && name && !Number.isNaN(price)) {
      out.push({ sku, name, brand, price, inStock });
    }
  });
  return out;
}

export function parsePastOrders(html: string): ParsedPastOrderProduct[] {
  const $ = cheerio.load(html);
  const acc = new Map<string, ParsedPastOrderProduct>();
  $('section[data-testid="past-orders"] li[data-product-id]').each((_i, el) => {
    const $el = $(el);
    const sku = $el.attr('data-product-id') ?? '';
    const name = $el.find('.item-name').first().text().trim();
    const brand = $el.find('.item-brand').first().text().trim() || null;
    if (!sku || !name) return;
    const existing = acc.get(sku);
    if (existing) {
      existing.timesPurchased++;
    } else {
      acc.set(sku, { sku, name, brand, timesPurchased: 1 });
    }
  });
  return [...acc.values()];
}

export function isLoggedOutPage(html: string): boolean {
  const $ = cheerio.load(html);
  return $('div[data-testid="login-required"]').length > 0;
}

const SEARCH_URL = (q: string) => `https://www.paknsave.co.nz/shop/search?q=${encodeURIComponent(q)}`;
const ORDERS_URL = 'https://www.paknsave.co.nz/shop/account/orders';

interface ComparePayload {
  shoppingListId: string;
  items: Array<{ id: string; name: string; canonicalFoodId: string | null }>;
  preferredBrandsByCanonicalFood: Record<string, string[]>;
}

export const paknsaveAdapter: StoreAdapter = {
  async handle(job: ScraperJob, browser: Browser): Promise<JobResult> {
    const storageState = await loadStorageState(job.householdId, 'paknsave');
    if (!storageState) {
      return { ok: false, error: 'no_session' };
    }

    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    try {
      if (job.type === 'compare_prices') {
        const payload = job.payload as ComparePayload | null;
        if (!payload || !Array.isArray(payload.items)) {
          return { ok: false, error: 'invalid_payload' };
        }
        const preferredMap: Record<string, Set<string>> = {};
        for (const [foodId, brands] of Object.entries(payload.preferredBrandsByCanonicalFood ?? {})) {
          preferredMap[foodId] = new Set(brands);
        }

        const items = [];
        for (const item of payload.items) {
          await page.goto(SEARCH_URL(item.name), { waitUntil: 'domcontentloaded' });
          const html = await page.content();
          if (isLoggedOutPage(html)) {
            return { ok: false, error: 'session_expired' };
          }
          const candidates = parseSearchResults(html);
          const match = pickMatch({ item, candidates, preferredBrandsByCanonicalFood: preferredMap });
          items.push({
            shoppingListItemId: item.id,
            sku: match?.sku ?? null,
            name: match?.name ?? null,
            brand: match?.brand ?? null,
            price: match?.price ?? null,
            inStock: match?.inStock ?? false,
            matched: !!match,
          });
        }
        return { ok: true, data: { items } };
      }

      if (job.type === 'import_past_orders') {
        await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' });
        const html = await page.content();
        if (isLoggedOutPage(html)) {
          return { ok: false, error: 'session_expired' };
        }
        const products = parsePastOrders(html).map(p => ({
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          canonicalFoodHint: null,
        }));
        return { ok: true, data: { products } };
      }

      return { ok: false, error: `unknown_type:${job.type}` };
    } finally {
      await context.close();
    }
  },
};
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `pnpm --filter @eat/scraper test -- paknsave`
Expected: PASS — 4 tests across `parseSearchResults`, `parsePastOrders`, `isLoggedOutPage`.

---

## Task 4: Pak'nSave bootstrap + smoke + package.json scripts

**Files:**
- Create: `apps/scraper/src/bootstrap/paknsave-login.ts`
- Create: `apps/scraper/src/smoke/paknsave.ts`
- Modify: `apps/scraper/package.json` (add 2 scripts)

- [ ] **Step 1: Create bootstrap/paknsave-login.ts**

```typescript
import 'dotenv/config';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OUT_DIR = join(homedir(), '.eat-thing');
const OUT_FILE = join(OUT_DIR, 'paknsave-storage.json');
const LOGIN_URL = 'https://www.paknsave.co.nz/account/login';

async function main() {
  console.log('Launching headed browser. Log in to Pak\'nSave, then wait.');
  console.log('Storage state will be saved to:', OUT_FILE);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL);

  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10 * 60 * 1000 });
  await page.waitForTimeout(2000);

  const storage = await context.storageState();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(storage));

  console.log('\nDone. Storage state saved.');
  console.log('Next: copy this file to the Mac mini, then run:');
  console.log(`  pnpm --filter @eat/scraper bootstrap:ingest --store paknsave --household <HOUSEHOLD_ID> --file ${OUT_FILE}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Create smoke/paknsave.ts**

```typescript
import 'dotenv/config';
import { chromium } from 'playwright';
import { loadStorageState } from '../session.js';
import { parseSearchResults, isLoggedOutPage } from '../stores/paknsave.js';

const HOUSEHOLD = process.env.SMOKE_HOUSEHOLD_ID;
const QUERY = process.argv[2] ?? 'eggs';

async function main() {
  if (!HOUSEHOLD) throw new Error('SMOKE_HOUSEHOLD_ID env var required');
  const storageState = await loadStorageState(HOUSEHOLD, 'paknsave');
  if (!storageState) throw new Error('No stored session for paknsave. Run bootstrap first.');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  await page.goto(`https://www.paknsave.co.nz/shop/search?q=${encodeURIComponent(QUERY)}`, { waitUntil: 'domcontentloaded' });
  const html = await page.content();

  if (isLoggedOutPage(html)) {
    console.error('Session expired. Re-run bootstrap.');
    process.exit(2);
  }

  const results = parseSearchResults(html);
  console.log(`Got ${results.length} results for "${QUERY}":`);
  for (const r of results.slice(0, 5)) {
    console.log(`  ${r.sku} ${r.name} (${r.brand ?? '?'}) $${r.price} ${r.inStock ? 'ok' : 'OOS'}`);
  }

  if (results.length === 0) {
    console.error('Zero results — selectors may be stale. Check fixtures README.');
    process.exit(3);
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Add scripts to apps/scraper/package.json**

Insert after the existing `smoke:newworld` script. Final scripts block:

```json
"scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "clean": "rm -rf dist",
    "test": "vitest run",
    "bootstrap:newworld": "tsx src/bootstrap/newworld-login.ts",
    "bootstrap:paknsave": "tsx src/bootstrap/paknsave-login.ts",
    "bootstrap:ingest": "tsx src/bootstrap/ingest.ts",
    "smoke:newworld": "tsx src/smoke/newworld.ts",
    "smoke:paknsave": "tsx src/smoke/paknsave.ts"
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm --filter @eat/scraper exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the scraper test suite**

Run: `pnpm --filter @eat/scraper test`
Expected: 46 tests pass (was 42; +4 new Pak'nSave tests).

- [ ] **Step 6: Commit Pak'nSave work**

```bash
git add apps/scraper/test/fixtures/paknsave/ \
        apps/scraper/src/stores/paknsave.ts \
        apps/scraper/src/stores/paknsave.test.ts \
        apps/scraper/src/bootstrap/paknsave-login.ts \
        apps/scraper/src/smoke/paknsave.ts \
        apps/scraper/package.json
git commit -m "phase3 slice2: Pak'nSave adapter, fixtures, bootstrap, smoke"
```

---

## Task 5: Woolworths fixtures

**Files:**
- Create: `apps/scraper/test/fixtures/woolworths/search.html`
- Create: `apps/scraper/test/fixtures/woolworths/orders.html`
- Create: `apps/scraper/test/fixtures/woolworths/logged-out.html`
- Create: `apps/scraper/test/fixtures/woolworths/README.md`

- [ ] **Step 1: Create search.html**

```html
<!doctype html>
<html><body>
  <main>
    <ul data-testid="product-grid">
      <li data-product-id="WW-001" data-in-stock="true">
        <h3 class="product-name">Free Range Eggs Size 7 (12 pk)</h3>
        <span class="product-brand">Mainland</span>
        <span class="product-price">$7.20</span>
      </li>
      <li data-product-id="WW-002" data-in-stock="true">
        <h3 class="product-name">Cage Eggs Size 6 (10 pk)</h3>
        <span class="product-brand">Woolworths</span>
        <span class="product-price">$4.80</span>
      </li>
      <li data-product-id="WW-003" data-in-stock="false">
        <h3 class="product-name">Organic Eggs (6 pk)</h3>
        <span class="product-brand">Henergy</span>
        <span class="product-price">$8.70</span>
      </li>
    </ul>
  </main>
</body></html>
```

- [ ] **Step 2: Create orders.html**

```html
<!doctype html>
<html><body>
  <main>
    <section data-testid="past-orders">
      <article class="order">
        <ul class="order-items">
          <li data-product-id="WW-001">
            <span class="item-name">Free Range Eggs Size 7 (12 pk)</span>
            <span class="item-brand">Mainland</span>
          </li>
          <li data-product-id="WW-100">
            <span class="item-name">Trim Milk 2L</span>
            <span class="item-brand">Anchor</span>
          </li>
        </ul>
      </article>
      <article class="order">
        <ul class="order-items">
          <li data-product-id="WW-100">
            <span class="item-name">Trim Milk 2L</span>
            <span class="item-brand">Anchor</span>
          </li>
        </ul>
      </article>
    </section>
  </main>
</body></html>
```

- [ ] **Step 3: Create logged-out.html**

```html
<!doctype html>
<html><body>
  <main>
    <div data-testid="login-required">
      <a href="/login">Sign in to see your orders</a>
    </div>
  </main>
</body></html>
```

- [ ] **Step 4: Create README.md**

```markdown
# Woolworths fixtures

Hand-rolled HTML mirroring the parsing surface used by the adapter
(`apps/scraper/src/stores/woolworths.ts`). Selectors:

- Search results: `ul[data-testid="product-grid"] > li[data-product-id]`
  with `.product-name`, `.product-brand`, `.product-price`,
  `data-in-stock="true"|"false"`.
- Past orders: `section[data-testid="past-orders"] li[data-product-id]`
  with `.item-name`, `.item-brand`.
- Logged-out marker: `div[data-testid="login-required"]`.

## Refreshing against the live site

When the smoke test fails because Woolworths ships markup changes:

1. Run `pnpm --filter @eat/scraper bootstrap:woolworths` and log in.
2. Navigate to search and orders pages, copy outerHTML via dev tools.
3. Update the parser in `woolworths.ts` to handle the new structure.
4. Replace the fixtures here with trimmed versions (drop nav chrome,
   keep the structures the parser reads).
5. Re-run `pnpm --filter @eat/scraper test`.
```

---

## Task 6: Woolworths failing parser test

**Files:**
- Create: `apps/scraper/src/stores/woolworths.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSearchResults, parsePastOrders, isLoggedOutPage } from './woolworths.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', '..', 'test', 'fixtures', 'woolworths');
const fixture = (name: string) => readFileSync(join(fixturesDir, name), 'utf8');

describe('parseSearchResults', () => {
  it('extracts sku, name, brand, price, in-stock', () => {
    const results = parseSearchResults(fixture('search.html'));
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      sku: 'WW-001',
      name: 'Free Range Eggs Size 7 (12 pk)',
      brand: 'Mainland',
      price: 7.20,
      inStock: true,
    });
    expect(results[2]?.inStock).toBe(false);
  });
});

describe('parsePastOrders', () => {
  it('deduplicates products across orders and counts frequency', () => {
    const products = parsePastOrders(fixture('orders.html'));
    expect(products).toHaveLength(2);
    const milk = products.find(p => p.sku === 'WW-100');
    expect(milk?.brand).toBe('Anchor');
    expect(milk?.timesPurchased).toBe(2);
  });
});

describe('isLoggedOutPage', () => {
  it('returns true for the login-required marker', () => {
    expect(isLoggedOutPage(fixture('logged-out.html'))).toBe(true);
  });
  it('returns false for normal pages', () => {
    expect(isLoggedOutPage(fixture('search.html'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @eat/scraper test -- woolworths`
Expected: FAIL — `parseSearchResults`, `parsePastOrders`, `isLoggedOutPage` not exported by current stub.

---

## Task 7: Woolworths full adapter implementation

**Files:**
- Modify (replace stub): `apps/scraper/src/stores/woolworths.ts`

- [ ] **Step 1: Replace the entire file contents**

```typescript
import * as cheerio from 'cheerio';
import type { Browser } from 'playwright';
import type { JobResult, ScraperJob } from '../worker-sdk/types.js';
import type { StoreAdapter } from './base.js';
import { loadStorageState } from '../session.js';
import { pickMatch } from './match.js';

export interface ParsedSearchResult {
  sku: string;
  name: string;
  brand: string | null;
  price: number;
  inStock: boolean;
}

export interface ParsedPastOrderProduct {
  sku: string;
  name: string;
  brand: string | null;
  timesPurchased: number;
}

export function parseSearchResults(html: string): ParsedSearchResult[] {
  const $ = cheerio.load(html);
  const out: ParsedSearchResult[] = [];
  $('ul[data-testid="product-grid"] > li[data-product-id]').each((_i, el) => {
    const $el = $(el);
    const sku = $el.attr('data-product-id') ?? '';
    const name = $el.find('.product-name').first().text().trim();
    const brand = $el.find('.product-brand').first().text().trim() || null;
    const priceText = $el.find('.product-price').first().text().trim().replace(/[^0-9.]/g, '');
    const price = parseFloat(priceText);
    const inStock = $el.attr('data-in-stock') === 'true';
    if (sku && name && !Number.isNaN(price)) {
      out.push({ sku, name, brand, price, inStock });
    }
  });
  return out;
}

export function parsePastOrders(html: string): ParsedPastOrderProduct[] {
  const $ = cheerio.load(html);
  const acc = new Map<string, ParsedPastOrderProduct>();
  $('section[data-testid="past-orders"] li[data-product-id]').each((_i, el) => {
    const $el = $(el);
    const sku = $el.attr('data-product-id') ?? '';
    const name = $el.find('.item-name').first().text().trim();
    const brand = $el.find('.item-brand').first().text().trim() || null;
    if (!sku || !name) return;
    const existing = acc.get(sku);
    if (existing) {
      existing.timesPurchased++;
    } else {
      acc.set(sku, { sku, name, brand, timesPurchased: 1 });
    }
  });
  return [...acc.values()];
}

export function isLoggedOutPage(html: string): boolean {
  const $ = cheerio.load(html);
  return $('div[data-testid="login-required"]').length > 0;
}

const SEARCH_URL = (q: string) => `https://www.woolworths.co.nz/shop/searchproducts?search=${encodeURIComponent(q)}`;
const ORDERS_URL = 'https://www.woolworths.co.nz/shop/myaccount/myorders';

interface ComparePayload {
  shoppingListId: string;
  items: Array<{ id: string; name: string; canonicalFoodId: string | null }>;
  preferredBrandsByCanonicalFood: Record<string, string[]>;
}

export const woolworthsAdapter: StoreAdapter = {
  async handle(job: ScraperJob, browser: Browser): Promise<JobResult> {
    const storageState = await loadStorageState(job.householdId, 'woolworths');
    if (!storageState) {
      return { ok: false, error: 'no_session' };
    }

    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    try {
      if (job.type === 'compare_prices') {
        const payload = job.payload as ComparePayload | null;
        if (!payload || !Array.isArray(payload.items)) {
          return { ok: false, error: 'invalid_payload' };
        }
        const preferredMap: Record<string, Set<string>> = {};
        for (const [foodId, brands] of Object.entries(payload.preferredBrandsByCanonicalFood ?? {})) {
          preferredMap[foodId] = new Set(brands);
        }

        const items = [];
        for (const item of payload.items) {
          await page.goto(SEARCH_URL(item.name), { waitUntil: 'domcontentloaded' });
          const html = await page.content();
          if (isLoggedOutPage(html)) {
            return { ok: false, error: 'session_expired' };
          }
          const candidates = parseSearchResults(html);
          const match = pickMatch({ item, candidates, preferredBrandsByCanonicalFood: preferredMap });
          items.push({
            shoppingListItemId: item.id,
            sku: match?.sku ?? null,
            name: match?.name ?? null,
            brand: match?.brand ?? null,
            price: match?.price ?? null,
            inStock: match?.inStock ?? false,
            matched: !!match,
          });
        }
        return { ok: true, data: { items } };
      }

      if (job.type === 'import_past_orders') {
        await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' });
        const html = await page.content();
        if (isLoggedOutPage(html)) {
          return { ok: false, error: 'session_expired' };
        }
        const products = parsePastOrders(html).map(p => ({
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          canonicalFoodHint: null,
        }));
        return { ok: true, data: { products } };
      }

      return { ok: false, error: `unknown_type:${job.type}` };
    } finally {
      await context.close();
    }
  },
};
```

- [ ] **Step 2: Run the test to confirm it passes**

Run: `pnpm --filter @eat/scraper test -- woolworths`
Expected: PASS — 4 tests across `parseSearchResults`, `parsePastOrders`, `isLoggedOutPage`.

---

## Task 8: Woolworths bootstrap + smoke + package.json scripts

**Files:**
- Create: `apps/scraper/src/bootstrap/woolworths-login.ts`
- Create: `apps/scraper/src/smoke/woolworths.ts`
- Modify: `apps/scraper/package.json` (add 2 scripts)

- [ ] **Step 1: Create bootstrap/woolworths-login.ts**

```typescript
import 'dotenv/config';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OUT_DIR = join(homedir(), '.eat-thing');
const OUT_FILE = join(OUT_DIR, 'woolworths-storage.json');
const LOGIN_URL = 'https://www.woolworths.co.nz/shop/securelogin';

async function main() {
  console.log('Launching headed browser. Log in to Woolworths, then wait.');
  console.log('Storage state will be saved to:', OUT_FILE);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL);

  await page.waitForURL(url => !url.pathname.includes('/login') && !url.pathname.includes('/securelogin'), { timeout: 10 * 60 * 1000 });
  await page.waitForTimeout(2000);

  const storage = await context.storageState();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(storage));

  console.log('\nDone. Storage state saved.');
  console.log('Next: copy this file to the Mac mini, then run:');
  console.log(`  pnpm --filter @eat/scraper bootstrap:ingest --store woolworths --household <HOUSEHOLD_ID> --file ${OUT_FILE}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Create smoke/woolworths.ts**

```typescript
import 'dotenv/config';
import { chromium } from 'playwright';
import { loadStorageState } from '../session.js';
import { parseSearchResults, isLoggedOutPage } from '../stores/woolworths.js';

const HOUSEHOLD = process.env.SMOKE_HOUSEHOLD_ID;
const QUERY = process.argv[2] ?? 'eggs';

async function main() {
  if (!HOUSEHOLD) throw new Error('SMOKE_HOUSEHOLD_ID env var required');
  const storageState = await loadStorageState(HOUSEHOLD, 'woolworths');
  if (!storageState) throw new Error('No stored session for woolworths. Run bootstrap first.');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  await page.goto(`https://www.woolworths.co.nz/shop/searchproducts?search=${encodeURIComponent(QUERY)}`, { waitUntil: 'domcontentloaded' });
  const html = await page.content();

  if (isLoggedOutPage(html)) {
    console.error('Session expired. Re-run bootstrap.');
    process.exit(2);
  }

  const results = parseSearchResults(html);
  console.log(`Got ${results.length} results for "${QUERY}":`);
  for (const r of results.slice(0, 5)) {
    console.log(`  ${r.sku} ${r.name} (${r.brand ?? '?'}) $${r.price} ${r.inStock ? 'ok' : 'OOS'}`);
  }

  if (results.length === 0) {
    console.error('Zero results — selectors may be stale. Check fixtures README.');
    process.exit(3);
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Add scripts to apps/scraper/package.json**

Final scripts block:

```json
"scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "clean": "rm -rf dist",
    "test": "vitest run",
    "bootstrap:newworld": "tsx src/bootstrap/newworld-login.ts",
    "bootstrap:paknsave": "tsx src/bootstrap/paknsave-login.ts",
    "bootstrap:woolworths": "tsx src/bootstrap/woolworths-login.ts",
    "bootstrap:ingest": "tsx src/bootstrap/ingest.ts",
    "smoke:newworld": "tsx src/smoke/newworld.ts",
    "smoke:paknsave": "tsx src/smoke/paknsave.ts",
    "smoke:woolworths": "tsx src/smoke/woolworths.ts"
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `pnpm --filter @eat/scraper exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the scraper test suite**

Run: `pnpm --filter @eat/scraper test`
Expected: 50 tests pass (was 46 after Pak'nSave; +4 new Woolworths tests).

- [ ] **Step 6: Commit Woolworths work**

```bash
git add apps/scraper/test/fixtures/woolworths/ \
        apps/scraper/src/stores/woolworths.ts \
        apps/scraper/src/stores/woolworths.test.ts \
        apps/scraper/src/bootstrap/woolworths-login.ts \
        apps/scraper/src/smoke/woolworths.ts \
        apps/scraper/package.json
git commit -m "phase3 slice2: Woolworths adapter, fixtures, bootstrap, smoke"
```

---

## Task 9: Full repo verification

- [ ] **Step 1: Run full unit suite from repo root**

Run: `pnpm test`
Expected: all green across all workspaces. Scraper now reports 50 tests (was 42); other workspaces unchanged.

- [ ] **Step 2: Run E2E suite**

Run: `pnpm test:e2e`
Expected: 13/13 pass. (No new E2E coverage in this slice — Phase 3 is exercised manually via smoke commands.)

---

## Task 10: PLAN.md update + commit

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Mark slice 2 adapter rows complete and add a Done log entry**

In the Phase 3 section, change the slice 2 block from:

```markdown
### Slice 2 — Pak'nSave + Woolworths + recommendation UI (next)

- [ ] Pak'nSave adapter (parser, fixtures, smoke command)
- [ ] Woolworths adapter (parser, fixtures, smoke command)
- [ ] Multi-store recommendation UI: cheapest store, convenient store, optional split shop
- [ ] Robustness: detect logged-out state and prompt user; retry/backoff for transient failures
- [ ] `launchd` plists so both the scraper and the OpenBrain sync worker auto-start on the Mac mini
```

to:

```markdown
### Slice 2 — Pak'nSave + Woolworths adapters (in progress)

- [x] Pak'nSave adapter (parser, fixtures, bootstrap, smoke) — _2026-05-11_
- [x] Woolworths adapter (parser, fixtures, bootstrap, smoke) — _2026-05-11_
- [ ] First-run login + smoke for Pak'nSave (user at browser)
- [ ] First-run login + smoke for Woolworths (user at browser)

### Slice 3 — Multi-store UI + production hardening (next)

- [ ] Multi-store recommendation UI: cheapest store, convenient store, optional split shop
- [ ] Multi-store `refresh-prices` enqueue (fan out per active session)
- [ ] Robustness: detect logged-out state and prompt user; retry/backoff for transient failures
- [ ] `launchd` plists so both the scraper and the OpenBrain sync worker auto-start on the Mac mini
```

- [ ] **Step 2: Append the Done log entry**

Add to the bottom of the Done log:

```markdown
- 2026-05-11 — Phase 3 slice 2: Pak'nSave + Woolworths adapters landed (parsers, fixtures, bootstrap, smoke). Smoke-only run path; multi-store enqueueing and UI deferred to slice 3. Live first-run login + smoke pending user.
```

- [ ] **Step 3: Commit**

```bash
git add PLAN.md
git commit -m "phase3 slice2: docs — mark adapters done, split slice 3 (UI + ops)"
```

---

## Self-review checklist (already performed)

- **Spec coverage:** Every section of the spec is covered.
  - Files-to-add list (spec) → Tasks 1, 2, 3, 4, 5, 6, 7, 8.
  - Per-adapter contract (spec) → Tasks 3 and 7 (full code).
  - Tests (spec) → Tasks 2 and 6.
  - Bootstrap commands (spec) → Tasks 4.1 and 8.1.
  - Smoke commands (spec) → Tasks 4.2 and 8.2.
  - Out-of-scope (spec) → respected — no changes to `shopping-lists.ts` `refresh-prices`, no UI changes, no robustness, no launchd.
  - Verification plan (spec) → Task 9.
- **Placeholders:** None. Every code step is full code, every command is exact.
- **Type consistency:** `parseSearchResults`, `parsePastOrders`, `isLoggedOutPage`, `paknsaveAdapter`, `woolworthsAdapter` shapes match `newworld.ts` slice-1 contract. `JobResult`, `ScraperJob`, `StoreAdapter` are imported from existing modules and not redefined.
- **Stop point:** Tasks 1–10 are autonomous. The user-only headed login + live smoke for the two new stores is explicitly listed in PLAN.md slice-2 remaining items (added in Task 10) and is the natural follow-up.
