ALTER TABLE "shopping_list_items" ADD COLUMN IF NOT EXISTS "source_recipe_id" uuid REFERENCES "recipes"("id") ON DELETE SET NULL;
