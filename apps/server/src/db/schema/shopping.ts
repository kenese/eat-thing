import { pgTable, uuid, text, timestamp, date, doublePrecision, boolean, unique } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { canonicalFoods } from './foods.js';
import { recipes } from './recipes.js';
import { shoppingSourceEnum } from './enums.js';

export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  finalizedAt: timestamp('finalized_at'),
  scheduledFor: date('scheduled_for'),
});

export const shoppingListItems = pgTable('shopping_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  shoppingListId: uuid('shopping_list_id').notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').references(() => canonicalFoods.id),
  name: text('name').notNull(),
  qty: doublePrecision('qty').notNull(),
  unit: text('unit').notNull(),
  source: shoppingSourceEnum('source').notNull(),
  checked: boolean('checked').notNull().default(false),
  sourceRecipeNames: text('source_recipe_names').array(),
  sourceRecipeId: uuid('source_recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
});

export const staples = pgTable('staples', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').notNull().references(() => canonicalFoods.id, { onDelete: 'cascade' }),
  thresholdQty: doublePrecision('threshold_qty').notNull(),
  thresholdUnit: text('threshold_unit').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [unique().on(t.householdId, t.canonicalFoodId)]);
