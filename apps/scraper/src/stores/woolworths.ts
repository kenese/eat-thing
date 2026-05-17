import * as cheerio from 'cheerio';
import type { Browser } from 'playwright';
import type { JobResult, ScraperJob } from '../worker-sdk/types.js';
import type { StoreAdapter } from './base.js';
import { loadStorageState } from '../session.js';
import { rankCandidates } from './match.js';
import type { ProductCandidate } from '@eat/shared';

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
  items: Array<{
    id: string;
    name: string;
    canonicalFoodId: string | null;
    requiredQty: number;
    requiredUnit: 'g' | 'ml' | 'count';
  }>;
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

        const items: Array<{
          shoppingListItemId: string;
          candidates: ProductCandidate[];
          chosenSku: string | null;
        }> = [];
        for (const item of payload.items) {
          await page.goto(SEARCH_URL(item.name), { waitUntil: 'domcontentloaded' });
          const html = await page.content();
          if (isLoggedOutPage(html)) {
            return { ok: false, error: 'session_expired' };
          }
          const parsed = parseSearchResults(html);
          // Adapt local ParsedSearchResult (no packSize/unitPrice/onSpecial) to newworld shape
          const adapted = parsed.map(c => ({
            ...c,
            packSize: null,
            unitPrice: null,
            onSpecial: false as const,
          }));
          const ranked = rankCandidates({
            item: {
              id: item.id,
              name: item.name,
              canonicalFoodId: item.canonicalFoodId,
              requiredQty: item.requiredQty,
              requiredUnit: item.requiredUnit,
            },
            candidates: adapted,
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
