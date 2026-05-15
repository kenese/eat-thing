import { ilike } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { canonicalFoods } from '../db/schema/index.js';

export type FoodCategory = 'produce' | 'meat' | 'dairy' | 'pantry' | 'frozen' | 'drinks' | 'other';

export async function findOrCreateFood(name: string, category: FoodCategory, defaultUnit: string): Promise<string> {
  const trimmed = name.trim();

  const [existing] = await db
    .select({ id: canonicalFoods.id })
    .from(canonicalFoods)
    .where(ilike(canonicalFoods.name, trimmed))
    .limit(1);

  if (existing) return existing.id;

  const result = await db
    .insert(canonicalFoods)
    .values({ id: uuidv4(), name: trimmed, category, defaultUnit, aliases: [] })
    .onConflictDoNothing()
    .returning({ id: canonicalFoods.id });

  if (result.length > 0) return result[0].id;

  // Race condition: another request inserted first — fetch it.
  const [conflict] = await db
    .select({ id: canonicalFoods.id })
    .from(canonicalFoods)
    .where(ilike(canonicalFoods.name, trimmed))
    .limit(1);
  return conflict.id;
}
