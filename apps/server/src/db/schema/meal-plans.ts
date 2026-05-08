import { pgTable, uuid, timestamp, date, doublePrecision } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { recipes } from './recipes.js';
import { mealStatusEnum } from './enums.js';

export const mealPlans = pgTable('meal_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(), // Monday of the planned week
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const mealPlanEntries = pgTable('meal_plan_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  mealPlanId: uuid('meal_plan_id').notNull().references(() => mealPlans.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id),
  servings: doublePrecision('servings').notNull(),
  status: mealStatusEnum('status').notNull().default('planned'),
});
