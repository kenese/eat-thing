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
