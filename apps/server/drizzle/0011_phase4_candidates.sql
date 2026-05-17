ALTER TABLE "shopping_list_prices" ADD COLUMN IF NOT EXISTS "candidates" jsonb;
ALTER TABLE "shopping_list_prices" ADD COLUMN IF NOT EXISTS "chosen_sku" text;
