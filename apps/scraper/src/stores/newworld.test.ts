import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSearchResults, parsePastOrders, isLoggedOutPage, parseTrolley, diffTrolley, buildCartResultFromActions, assertNewWorldResponse } from './newworld.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', '..', 'test', 'fixtures', 'newworld');
const fixture = (name: string) => readFileSync(join(fixturesDir, name), 'utf8');

describe('parseSearchResults', () => {
  it('extracts sku, name, brand, price, in-stock', () => {
    const results = parseSearchResults(fixture('search.html'));
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      sku: '5312709',
      name: 'Rise N Shine Fresh Colony Mixed Grade Eggs 12pk',
      brand: null,
      price: 11.99,
      inStock: true,
      packSize: { qty: 12, unit: 'count' },
      unitPrice: { value: 1.0, per: 'count' },
      onSpecial: false,
    });
    expect(results[2]?.inStock).toBe(false);
  });
});

describe('parsePastOrders', () => {
  it('deduplicates products across orders and counts frequency', () => {
    const products = parsePastOrders(fixture('orders.html'));
    expect(products).toHaveLength(2);
    const milk = products.find(p => p.sku === 'NW-100');
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

describe('parseTrolley', () => {
  it('parses sku + qty pairs from trolley HTML', () => {
    const html = readFileSync(join(here, 'newworld-trolley.fixture.html'), 'utf8');
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

describe('assertNewWorldResponse', () => {
  it('throws stable HTTP errors for retryable upstream responses', () => {
    expect(() => assertNewWorldResponse(429)).toThrow('HTTP 429');
    expect(() => assertNewWorldResponse(503)).toThrow('HTTP 503');
  });

  it('accepts successful and missing Playwright responses', () => {
    expect(() => assertNewWorldResponse(200)).not.toThrow();
    expect(() => assertNewWorldResponse(null)).not.toThrow();
  });
});
