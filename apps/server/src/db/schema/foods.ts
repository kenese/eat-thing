import { pgTable, uuid, text, timestamp, doublePrecision } from 'drizzle-orm/pg-core';

// Global curated list — not scoped by household.
// New entries must go through taxonomy review; no silent inserts.
export const canonicalFoods = pgTable('canonical_foods', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  defaultUnit: text('default_unit').notNull(), // 'g' | 'ml' | 'count'
  aliases: text('aliases').array().notNull().default([]),
  densityGPerMl: doublePrecision('density_g_per_ml'), // enables g↔ml conversion; null if not applicable
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
