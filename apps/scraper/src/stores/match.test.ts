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
