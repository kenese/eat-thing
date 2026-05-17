import type { ParsedSearchResult } from './newworld.js';
import type { ProductCandidate, ProductCandidateUnit } from '@eat/shared';

export interface ListItemForMatch {
  id: string;
  name: string;
  canonicalFoodId: string | null;
  requiredQty: number;
  requiredUnit: ProductCandidateUnit;
}

export interface RankInput {
  item: ListItemForMatch;
  candidates: ParsedSearchResult[];
  preferredBrandsByCanonicalFood: Record<string, Set<string>>;
  topN: number;
}

const STOPWORDS = new Set(['the', 'a', 'and', 'or', 'pk', 'pack', 'g', 'kg', 'ml', 'l']);

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !STOPWORDS.has(t)),
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

function normaliseUnitPrice(up: ParsedSearchResult['unitPrice']): number | null {
  if (!up) return null;
  return up.value;
}

function sufficientPackMultiplier(
  pack: ParsedSearchResult['packSize'],
  requiredQty: number,
  requiredUnit: ProductCandidateUnit,
): number | null {
  if (!pack) return null;
  if (pack.unit !== requiredUnit) return null;
  if (pack.qty <= 0) return null;
  return Math.max(1, Math.ceil(requiredQty / pack.qty));
}

export function rankCandidates(input: RankInput): ProductCandidate[] {
  const { item, candidates, preferredBrandsByCanonicalFood, topN } = input;
  if (candidates.length === 0) return [];

  const itemTokens = tokens(item.name);

  type Scored = {
    cand: ParsedSearchResult;
    cartQty: number | null;
    nameScore: number;
    unitPrice: number | null;
    isPreferred: boolean;
  };

  const preferredBrands = item.canonicalFoodId ? preferredBrandsByCanonicalFood[item.canonicalFoodId] : undefined;

  const scored: Scored[] = candidates.map(c => ({
    cand: c,
    cartQty: sufficientPackMultiplier(c.packSize, item.requiredQty, item.requiredUnit),
    nameScore: tokenOverlap(tokens(c.name), itemTokens),
    unitPrice: normaliseUnitPrice(c.unitPrice),
    isPreferred: !!(preferredBrands && c.brand && preferredBrands.has(c.brand)),
  }));

  // Prefer single-pack candidates (cartQty === 1) as viable.
  // Only fall back to multi-pack candidates if no single-pack option exists.
  const singlePack = scored.filter(s => s.cartQty === 1 && s.unitPrice !== null && s.nameScore > 0);
  const multiPack = scored.filter(s => s.cartQty !== null && s.cartQty > 1 && s.unitPrice !== null && s.nameScore > 0);
  const viable = singlePack.length > 0 ? singlePack : multiPack;
  const fallback = scored.filter(s => !viable.includes(s) && s.nameScore > 0);

  viable.sort((a, b) => (a.unitPrice! - b.unitPrice!));

  let resolution: 'sole' | 'preferred' | 'manual';
  let winnerSku: string | null = null;

  if (viable.length === 1) {
    resolution = 'sole';
    winnerSku = viable[0]!.cand.sku;
  } else if (viable.length > 1) {
    const preferredInTop3 = viable.slice(0, 3).find(s => s.isPreferred);
    if (preferredInTop3) {
      resolution = 'preferred';
      winnerSku = preferredInTop3.cand.sku;
    } else {
      resolution = 'manual';
    }
  } else {
    resolution = 'manual';
  }

  const orderedViable = winnerSku
    ? [viable.find(s => s.cand.sku === winnerSku)!, ...viable.filter(s => s.cand.sku !== winnerSku)]
    : viable;

  const combined: Scored[] = [...orderedViable, ...fallback];
  const sliced = combined.slice(0, Math.max(topN, 1));

  return sliced.map((s, idx): ProductCandidate => {
    const isViable = viable.includes(s);
    const candResolution: ProductCandidate['resolution'] =
      isViable && idx === 0 && resolution !== 'manual' ? resolution : 'manual';
    return {
      sku: s.cand.sku,
      name: s.cand.name,
      brand: s.cand.brand,
      packSize: s.cand.packSize,
      price: s.cand.price,
      unitPrice: s.cand.unitPrice,
      inStock: s.cand.inStock,
      onSpecial: s.cand.onSpecial,
      cartQty: s.cartQty ?? 1,
      resolution: candResolution,
    };
  });
}
