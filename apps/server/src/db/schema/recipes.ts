import { pgTable, uuid, text, timestamp, doublePrecision, boolean, integer } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { canonicalFoods } from './foods.js';

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sourceUrl: text('source_url'),
  sourceImage: text('source_image'), // full public URL (Supabase Storage or external)
  instructions: text('instructions'),
  servings: doublePrecision('servings').notNull().default(4),
  totalTimeMinutes: integer('total_time_minutes'),
  tags: text('tags').array().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const recipeIngredients = pgTable('recipe_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').notNull().references(() => canonicalFoods.id),
  qty: text('qty').notNull(),
  unit: text('unit').notNull(),
  section: text('section'),
  metricValue: text('metric_value'),
  optional: boolean('optional').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});
