import { describe, it, expect } from 'vitest';
import {
  toCanonical,
  fromCanonical,
  mlToG,
  gToMl,
} from './convert';

describe('toCanonical', () => {
  it('passes count through unchanged', () => {
    expect(toCanonical(3, 'count')).toEqual({ qty: 3, unit: 'count' });
  });

  it('converts ml (identity)', () => {
    expect(toCanonical(250, 'ml')).toEqual({ qty: 250, unit: 'ml' });
  });

  it('converts litres to ml', () => {
    expect(toCanonical(1.5, 'l')).toEqual({ qty: 1500, unit: 'ml' });
  });

  it('converts tsp to ml (5 ml each)', () => {
    expect(toCanonical(2, 'tsp')).toEqual({ qty: 10, unit: 'ml' });
  });

  it('converts tbsp to ml (15 ml each)', () => {
    expect(toCanonical(4, 'tbsp')).toEqual({ qty: 60, unit: 'ml' });
  });

  it('converts NZ cup (250 ml) to ml', () => {
    expect(toCanonical(1, 'cup')).toEqual({ qty: 250, unit: 'ml' });
  });

  it('converts g (identity)', () => {
    expect(toCanonical(100, 'g')).toEqual({ qty: 100, unit: 'g' });
  });

  it('converts kg to g', () => {
    expect(toCanonical(1, 'kg')).toEqual({ qty: 1000, unit: 'g' });
  });

  it('converts oz to g', () => {
    expect(toCanonical(1, 'oz').unit).toBe('g');
    expect(toCanonical(1, 'oz').qty).toBeCloseTo(28.3495);
  });

  it('converts lb to g', () => {
    expect(toCanonical(1, 'lb').unit).toBe('g');
    expect(toCanonical(1, 'lb').qty).toBeCloseTo(453.592);
  });
});

describe('fromCanonical', () => {
  it('count → count', () => {
    expect(fromCanonical(5, 'count', 'count')).toBe(5);
  });

  it('count → non-count returns null', () => {
    expect(fromCanonical(5, 'count', 'g')).toBeNull();
    expect(fromCanonical(5, 'count', 'ml')).toBeNull();
  });

  it('ml → ml (identity)', () => {
    expect(fromCanonical(250, 'ml', 'ml')).toBe(250);
  });

  it('ml → cup', () => {
    expect(fromCanonical(500, 'ml', 'cup')).toBe(2);
  });

  it('ml → l', () => {
    expect(fromCanonical(1500, 'ml', 'l')).toBe(1.5);
  });

  it('ml → g with density', () => {
    expect(fromCanonical(100, 'ml', 'g', { densityGPerMl: 1.0 })).toBeCloseTo(100);
  });

  it('ml → g without density returns null', () => {
    expect(fromCanonical(100, 'ml', 'g')).toBeNull();
  });

  it('g → g (identity)', () => {
    expect(fromCanonical(500, 'g', 'g')).toBe(500);
  });

  it('g → kg', () => {
    expect(fromCanonical(1000, 'g', 'kg')).toBe(1);
  });

  it('g → ml with density', () => {
    expect(fromCanonical(200, 'g', 'ml', { densityGPerMl: 1.0 })).toBeCloseTo(200);
  });

  it('g → ml without density returns null', () => {
    expect(fromCanonical(200, 'g', 'ml')).toBeNull();
  });

  it('g → cup with density (water: 1 g/ml, 1 cup = 250 g)', () => {
    expect(fromCanonical(500, 'g', 'cup', { densityGPerMl: 1.0 })).toBe(2);
  });
});

describe('mlToG / gToMl', () => {
  it('mlToG multiplies by density', () => {
    expect(mlToG(100, 1.2)).toBeCloseTo(120);
  });

  it('gToMl divides by density', () => {
    expect(gToMl(120, 1.2)).toBeCloseTo(100);
  });

  it('round-trips: mlToG then gToMl', () => {
    const density = 0.85;
    const originalMl = 250;
    expect(gToMl(mlToG(originalMl, density), density)).toBeCloseTo(originalMl);
  });
});
