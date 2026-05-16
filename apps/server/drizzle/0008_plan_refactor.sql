-- Plan refactor: drop weekly meal_plans grouping; entries own household_id directly.
-- Add source_recipe_id to shopping_list_items for modal pre-tick matching.

-- 1. Backfill household_id on meal_plan_entries (column already exists as NOT NULL, but
--    we need to ensure the FK to meal_plans is removable). Drop FK first.
ALTER TABLE "meal_plan_entries" DROP CONSTRAINT IF EXISTS "meal_plan_entries_meal_plan_id_meal_plans_id_fk";

-- 2. Drop the meal_plan_id column from meal_plan_entries.
ALTER TABLE "meal_plan_entries" DROP COLUMN IF EXISTS "meal_plan_id";

-- 3. Drop the FK on shopping_lists.generated_from_meal_plan_id, then the column.
ALTER TABLE "shopping_lists" DROP CONSTRAINT IF EXISTS "shopping_lists_generated_from_meal_plan_id_meal_plans_id_fk";
ALTER TABLE "shopping_lists" DROP COLUMN IF EXISTS "generated_from_meal_plan_id";

-- 4. Drop the meal_plans table entirely.
DROP TABLE IF EXISTS "meal_plans";

-- 5. Add source_recipe_id to shopping_list_items (nullable; only recipe-sourced items carry it).
ALTER TABLE "shopping_list_items"
  ADD COLUMN "source_recipe_id" uuid REFERENCES "recipes"("id") ON DELETE SET NULL;
