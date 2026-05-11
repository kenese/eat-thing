import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from './index.js';
import { canonicalFoods } from './schema/index.js';
import { type SeedFood, SEED_FOODS } from '@eat/taxonomy';

async function seed() {
  console.log(`Seeding ${SEED_FOODS.length} canonical foods…`);

  await db
    .insert(canonicalFoods)
    .values(
      SEED_FOODS.map((f) => ({
        name: f.name,
        defaultUnit: f.defaultUnit,
        // category is transitionally optional on SeedFood until Task 13 adds the field.
        // Once Task 13 lands, (f as any).category will be the annotated value.
        category: (f as SeedFood & { category?: string }).category ?? 'other',
        aliases: f.aliases,
        densityGPerMl: f.densityGPerMl ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: canonicalFoods.name,
      set: {
        category: sql`EXCLUDED.category`,
      },
    });

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
