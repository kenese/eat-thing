export interface ListItemForMatch {
  id: string;
  name: string;
  canonicalFoodId: string | null;
}

export interface SearchResult {
  sku: string;
  name: string;
  brand: string | null;
  price: number;
  inStock: boolean;
}

export interface MatchInput {
  item: ListItemForMatch;
  candidates: SearchResult[];
  preferredBrandsByCanonicalFood: Record<string, Set<string>>;
}

const STOPWORDS = new Set(['the', 'a', 'and', 'or', 'pk', 'pack', 'g', 'kg', 'ml', 'l']);

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !STOPWORDS.has(t))
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

export function pickMatch({ item, candidates, preferredBrandsByCanonicalFood }: MatchInput): SearchResult | null {
  if (candidates.length === 0) return null;

  const itemTokens = tokens(item.name);
  if (itemTokens.size === 0) return null;

  const preferredBrands = item.canonicalFoodId ? preferredBrandsByCanonicalFood[item.canonicalFoodId] : undefined;

  function score(c: SearchResult): number {
    return tokenOverlap(tokens(c.name), itemTokens);
  }

  if (preferredBrands && preferredBrands.size > 0) {
    const preferred = candidates.filter(c => c.brand && preferredBrands.has(c.brand));
    if (preferred.length > 0) {
      const best = preferred.reduce((a, b) => (score(b) > score(a) ? b : a));
      if (score(best) > 0) return best;
    }
  }

  const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));
  return score(best) > 0 ? best : null;
}
