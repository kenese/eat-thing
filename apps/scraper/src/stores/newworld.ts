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
    if (sku && name && !Number.isNaN(price)) {
      out.push({ sku, name, brand: null, price, inStock });
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

interface ComparePayload {
  shoppingListId: string;
  items: Array<{ id: string; name: string; canonicalFoodId: string | null }>;
  preferredBrandsByCanonicalFood: Record<string, string[]>;
}

export const newWorldAdapter: StoreAdapter = {
  async handle(job: ScraperJob, browser: Browser): Promise<JobResult> {
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

        const items = [];
        for (const item of payload.items) {
          await page.goto(SEARCH_URL(item.name), { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('p[data-testid="product-title"]', { timeout: 15000 }).catch(() => {});
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
