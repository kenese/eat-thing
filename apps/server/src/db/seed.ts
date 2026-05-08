import 'dotenv/config';
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
        aliases: f.aliases,
        densityGPerMl: f.densityGPerMl ?? null,
      })),
    )
    .onConflictDoNothing();

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
