export const VOLUME_UNITS = ['ml', 'l', 'tsp', 'tbsp', 'cup'] as const;
export const MASS_UNITS = ['g', 'kg', 'oz', 'lb'] as const;

export type VolumeUnit = (typeof VOLUME_UNITS)[number];
export type MassUnit = (typeof MASS_UNITS)[number];
export type DisplayUnit = VolumeUnit | MassUnit | 'count';
export type CanonicalUnit = 'g' | 'ml' | 'count';

// NZ/Australian metric cup = 250 ml
export const ML_PER_UNIT: Record<VolumeUnit, number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 250,
};

export const G_PER_UNIT: Record<MassUnit, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

export function isVolumeUnit(u: string): u is VolumeUnit {
  return VOLUME_UNITS.includes(u as VolumeUnit);
}

export function isMassUnit(u: string): u is MassUnit {
  return MASS_UNITS.includes(u as MassUnit);
}

/**
 * Convert a display quantity to its natural canonical unit.
 * Volume display units → ml. Mass display units → g. Count → count.
 * Does NOT cross mass↔volume — use mlToG / gToMl for that.
 */
export function toCanonical(qty: number, from: DisplayUnit): { qty: number; unit: CanonicalUnit } {
  if (from === 'count') return { qty, unit: 'count' };
  if (isVolumeUnit(from)) return { qty: qty * ML_PER_UNIT[from], unit: 'ml' };
  return { qty: qty * G_PER_UNIT[from], unit: 'g' };
}

/** ml → g using the food's density. */
export function mlToG(ml: number, densityGPerMl: number): number {
  return ml * densityGPerMl;
}

/** g → ml using the food's density. */
export function gToMl(grams: number, densityGPerMl: number): number {
  return grams / densityGPerMl;
}

/**
 * Convert a canonical quantity to a display unit.
 * Returns null when the conversion is impossible (e.g. ml→g without density).
 */
export function fromCanonical(
  qty: number,
  unit: CanonicalUnit,
  to: DisplayUnit,
  opts: { densityGPerMl?: number } = {},
): number | null {
  if (unit === 'count') return to === 'count' ? qty : null;

  if (unit === 'ml') {
    if (isVolumeUnit(to)) return qty / ML_PER_UNIT[to];
    if (isMassUnit(to) && opts.densityGPerMl != null)
      return mlToG(qty, opts.densityGPerMl) / G_PER_UNIT[to];
    return null;
  }

  // unit === 'g'
  if (isMassUnit(to)) return qty / G_PER_UNIT[to];
  if (isVolumeUnit(to) && opts.densityGPerMl != null)
    return gToMl(qty, opts.densityGPerMl) / ML_PER_UNIT[to];
  return null;
}
