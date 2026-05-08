import { pgTable, uuid, text, timestamp, doublePrecision, boolean, unique } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { canonicalFoods } from './foods.js';
import { mealPlans } from './meal-plans.js';
import { canonicalUnitEnum, shoppingSourceEnum } from './enums.js';

export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  generatedFromMealPlanId: uuid('generated_from_meal_plan_id').references(() => mealPlans.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  finalizedAt: timestamp('finalized_at'),
});

export const shoppingListItems = pgTable('shopping_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  shoppingListId: uuid('shopping_list_id').notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').references(() => canonicalFoods.id),
  name: text('name').notNull(), // denormalised display name; null canonicalFoodId = manual free-text item
  qty: doublePrecision('qty').notNull(),
  unit: canonicalUnitEnum('unit').notNull(),
  source: shoppingSourceEnum('source').notNull(),
  checked: boolean('checked').notNull().default(false),
});

export const staples = pgTable('staples', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').notNull().references(() => canonicalFoods.id, { onDelete: 'cascade' }),
  thresholdQty: doublePrecision('threshold_qty').notNull(),
  thresholdUnit: canonicalUnitEnum('threshold_unit').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [unique().on(t.householdId, t.canonicalFoodId)]);
