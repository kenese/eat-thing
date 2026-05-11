CREATE TABLE "scraper_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"store" "store" NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "shopping_list_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopping_list_item_id" uuid NOT NULL,
	"store" "store" NOT NULL,
	"sku" text,
	"name" text,
	"price" numeric(10, 2),
	"in_stock" boolean DEFAULT true NOT NULL,
	"matched" boolean DEFAULT true NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_list_prices_shopping_list_item_id_store_unique" UNIQUE("shopping_list_item_id","store")
);
--> statement-breakpoint
ALTER TABLE "canonical_foods" ADD COLUMN "category" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "scraper_jobs" ADD CONSTRAINT "scraper_jobs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_prices" ADD CONSTRAINT "shopping_list_prices_shopping_list_item_id_shopping_list_items_id_fk" FOREIGN KEY ("shopping_list_item_id") REFERENCES "public"."shopping_list_items"("id") ON DELETE cascade ON UPDATE no action;