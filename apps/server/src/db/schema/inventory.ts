import { pgTable, uuid, text, timestamp, doublePrecision, jsonb, boolean } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { canonicalFoods } from './foods.js';
import { canonicalUnitEnum, inventoryLocationEnum } from './enums.js';

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').notNull().references(() => canonicalFoods.id),
  qty: doublePrecision('qty').notNull(),
  unit: canonicalUnitEnum('unit').notNull(),
  brand: text('brand'),
  location: inventoryLocationEnum('location').notNull().default('pantry'),
  purchasedAt: timestamp('purchased_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Append-only. Source of truth for what happened in the kitchen.
// Never edit a cook event; emit a new one to correct mistakes.
export const cookEvents = pgTable('cook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  mealPlanEntryId: uuid('meal_plan_entry_id'), // nullable: cook events can be ad-hoc (no meal plan)
  cookedAt: timestamp('cooked_at').notNull().defaultNow(),
  // [{ inventoryItemId, canonicalFoodId, qty, unit }]
  deductions: jsonb('deductions').notNull().default([]),
  // [{ question, answer, inventoryItemId? }] — user responses to ambiguous-unit prompts
  promptsResolved: jsonb('prompts_resolved').notNull().default([]),
  synced: boolean('synced').notNull().default(false), // flipped by daily OpenBrain roll-up
});
