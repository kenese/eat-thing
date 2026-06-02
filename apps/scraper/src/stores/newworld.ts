import * as cheerio from 'cheerio';
import type { Browser, Page } from 'playwright';
import type { JobResult, ScraperJob } from '../worker-sdk/types.js';
import type { StoreAdapter } from './base.js';
import { loadStorageState } from '../session.js';
import { rankCandidates } from './match.js';
import type { CartActionResult, CartJobResult, ProductCandidate } from '@eat/shared';

export type PackUnit = 'g' | 'ml' | 'count';

const PACK_SIZE_RE = /(\d+(?:\.\d+)?)\s*(kg|g|ml|l|pk|pack|ea|each)\b/i;
const UNIT_PRICE_RE = /\$\s*(\d+(?:\.\d+)?)\s*(?:(?:\/|per)\s*(\d+)?\s*)?(kg|g|ml|l|each|ea|count)/i;

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

export interface ParsedPastOrderProduct {
  sku: string;
  name: string;
  brand: string | null;
  timesPurchased: number;
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
    const inStock = $el.find('button[data-testid="add-to-cart"]').length > 0;
    const unitPriceText = $el.find('p[data-testid="unit-price"]').first().text().trim();
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

const SEARCH_URL = (q: string) => `https://www.newworld.co.nz/shop/search?q=${encodeURIComponent(q)}`;
const ORDERS_URL = 'https://www.newworld.co.nz/shop/account/orders';

export function assertNewWorldResponse(status: number | null): void {
  if (status === 429 || (status !== null && status >= 500)) {
    throw new Error(`HTTP ${status}`);
  }
}

async function gotoNewWorld(page: Page, url: string): Promise<void> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assertNewWorldResponse(response?.status() ?? null);
}

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

export function buildCartResultFromActions(
  actions: TrolleyDiffAction[],
  attempts: Map<string, { ok: boolean; reason?: string }>,
  skuToShoppingListItemId: Map<string, string>,
): CartActionResult[] {
  return actions.map(a => {
    const itemId = skuToShoppingListItemId.get(a.sku) ?? a.sku;
    if (a.action === 'skip') {
      return { shoppingListItemId: itemId, sku: a.sku, requestedQty: a.qty, action: 'already_in_cart' as const };
    }
    const att = attempts.get(a.sku);
    if (att?.ok) {
      return {
        shoppingListItemId: itemId,
        sku: a.sku,
        requestedQty: a.qty,
        action: (a.action === 'add' ? 'added' : 'qty_increased') as CartActionResult['action'],
      };
    }
    return {
      shoppingListItemId: itemId,
      sku: a.sku,
      requestedQty: a.qty,
      action: 'failed' as const,
      failureReason: att?.reason ?? 'unknown',
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
    await gotoNewWorld(page, TROLLEY_URL);
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
        await gotoNewWorld(page, PRODUCT_URL(a.sku));
        const qtyInput = page.locator('input[data-testid="qty-input"]');
        await qtyInput.waitFor({ timeout: 5000 });
        await qtyInput.fill(String(a.qty));
        const addBtn = page.locator('button[data-testid="add-to-trolley"]');
        await addBtn.click();
        await page.locator('[data-testid="trolley-count-badge"]').waitFor({ timeout: 3000 });
        attempts.set(a.sku, { ok: true });
      } catch (err) {
        const reason =
          err instanceof Error && /selector|timeout/i.test(err.message)
            ? 'product_unavailable'
            : err instanceof Error
              ? err.message
              : 'unknown';
        attempts.set(a.sku, { ok: false, reason });
      }
      await page.waitForTimeout(700); // throttle
    }

    // 4) Read trolley back for total
    await gotoNewWorld(page, TROLLEY_URL);
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

export const newWorldAdapter: StoreAdapter = {
  async handle(job: ScraperJob, browser: Browser): Promise<JobResult> {
    // add_to_cart opens its own context inside handleAddToCart — dispatch before
    // the outer context is created so there is no double-close.
    if (job.type === 'add_to_cart') {
      return handleAddToCart(job, browser);
    }

    const storageState = await loadStorageState(job.householdId, 'new_world');
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

        const items: Array<{
          shoppingListItemId: string;
          candidates: ProductCandidate[];
          chosenSku: string | null;
        }> = [];
        for (const item of payload.items) {
          await gotoNewWorld(page, SEARCH_URL(item.name));
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
      }

      if (job.type === 'import_past_orders') {
        await gotoNewWorld(page, ORDERS_URL);
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
