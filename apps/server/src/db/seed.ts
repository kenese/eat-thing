import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from './index.js';
import { canonicalFoods } from './schema/index.js';
import { SEED_FOODS } from '@eat/taxonomy';

async function seed() {
  console.log(`Seeding ${SEED_FOODS.length} canonical foods…`);

  await db
    .insert(canonicalFoods)
    .values(
      SEED_FOODS.map((f) => ({
        name: f.name,
        defaultUnit: f.defaultUnit,
        category: f.category,
        aliases: f.aliases,
        densityGPerMl: f.densityGPerMl ?? null,
        countToGrams: f.countToGrams ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: canonicalFoods.name,
      set: {
        category: sql`EXCLUDED.category`,
        aliases: sql`EXCLUDED.aliases`,
        defaultUnit: sql`EXCLUDED.default_unit`,
        densityGPerMl: sql`EXCLUDED.density_g_per_ml`,
        countToGrams: sql`EXCLUDED.count_to_grams`,
      },
    });

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
