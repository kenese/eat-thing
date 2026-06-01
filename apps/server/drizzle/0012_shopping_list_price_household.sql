ALTER TABLE "shopping_list_prices" ADD COLUMN "household_id" uuid;
--> statement-breakpoint
UPDATE "shopping_list_prices" AS "prices"
SET "household_id" = "items"."household_id"
FROM "shopping_list_items" AS "items"
WHERE "prices"."shopping_list_item_id" = "items"."id";
--> statement-breakpoint
ALTER TABLE "shopping_list_prices" ALTER COLUMN "household_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shopping_list_prices" ADD CONSTRAINT "shopping_list_prices_household_id_households_id_fk"
FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;
