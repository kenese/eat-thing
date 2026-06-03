ALTER TABLE "shopping_lists"
  ADD COLUMN IF NOT EXISTS "scheduled_for" date;
