import { ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import { canonicalFoods } from '../db/schema/index.js';

export type FoodCategory = 'produce' | 'meat' | 'dairy' | 'pantry' | 'frozen' | 'drinks' | 'other';

export interface TaxonomyReviewMatch {
  id: string;
  name: string;
  category: FoodCategory;
  defaultUnit: string;
}

export type ExistingFoodOrReview =
  | { kind: 'existing'; id: string }
  | {
      kind: 'review';
      proposed: { name: string; category: FoodCategory; defaultUnit: string };
      matches: TaxonomyReviewMatch[];
    };

export async function findExistingFoodOrRequireReview(
  name: string,
  category: FoodCategory,
  defaultUnit: string,
): Promise<ExistingFoodOrReview> {
  const trimmed = name.trim();

  const matches = await db
    .select({
      id: canonicalFoods.id,
      name: canonicalFoods.name,
      category: canonicalFoods.category,
      defaultUnit: canonicalFoods.defaultUnit,
    })
    .from(canonicalFoods)
    .where(ilike(canonicalFoods.name, `%${trimmed}%`))
    .limit(5);

  const exact = matches.find((match) => match.name.toLowerCase() === trimmed.toLowerCase());
  if (exact) {
    return { kind: 'existing', id: exact.id };
  }

  return {
    kind: 'review',
    proposed: { name: trimmed, category, defaultUnit },
    matches: matches.map(match => ({
      id: match.id,
      name: match.name,
      category: match.category as FoodCategory,
      defaultUnit: match.defaultUnit,
    })),
  };
}
