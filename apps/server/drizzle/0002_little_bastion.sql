ALTER TABLE "inventory_items" ALTER COLUMN "unit" SET DATA TYPE text USING "unit"::text;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ALTER COLUMN "qty" SET DATA TYPE text USING "qty"::text;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ALTER COLUMN "unit" SET DATA TYPE text USING "unit"::text;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ALTER COLUMN "unit" SET DATA TYPE text USING "unit"::text;--> statement-breakpoint
ALTER TABLE "staples" ALTER COLUMN "threshold_unit" SET DATA TYPE text USING "threshold_unit"::text;--> statement-breakpoint
DROP TYPE "public"."canonical_unit";
