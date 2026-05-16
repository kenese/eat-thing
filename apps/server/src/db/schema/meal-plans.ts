import { pgTable, uuid, date, doublePrecision } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { recipes } from './recipes.js';
import { mealStatusEnum } from './enums.js';

export const mealPlanEntries = pgTable('meal_plan_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id),
  servings: doublePrecision('servings').notNull(),
  status: mealStatusEnum('status').notNull().default('planned'),
});
