import { pgTable, uuid, text, timestamp, doublePrecision, boolean, integer } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { canonicalFoods } from './foods.js';
import { canonicalUnitEnum } from './enums.js';

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sourceUrl: text('source_url'),
  sourceImage: text('source_image'), // Supabase Storage path
  instructions: text('instructions'),
  servings: doublePrecision('servings').notNull().default(4),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const recipeIngredients = pgTable('recipe_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').notNull().references(() => canonicalFoods.id),
  qty: doublePrecision('qty').notNull(),
  unit: canonicalUnitEnum('unit').notNull(),
  optional: boolean('optional').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});
