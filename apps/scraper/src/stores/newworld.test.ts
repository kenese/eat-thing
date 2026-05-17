import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSearchResults, parsePastOrders, isLoggedOutPage } from './newworld.js';

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
