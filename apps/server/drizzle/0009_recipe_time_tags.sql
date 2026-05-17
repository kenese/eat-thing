-- Add total_time_minutes (nullable int) and tags (text array) to recipes.
-- Existing rows get NULL time and empty tags array — clients handle gracefully.

ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "total_time_minutes" integer;
ALTER TABLE "recipes" ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}';
