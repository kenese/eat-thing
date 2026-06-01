-- Normalize inventory units to the canonical storage set before constraining the column.
-- Any historical non-canonical rows are coerced to the associated canonical food's
-- default_unit; the app now only accepts g/ml/count on create/update.
UPDATE "inventory_items" AS ii
SET "unit" = cf."default_unit"
FROM "canonical_foods" AS cf
WHERE ii."canonical_food_id" = cf."id"
  AND ii."unit" NOT IN ('g', 'ml', 'count');

ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_unit_canonical_check"
  CHECK ("unit" IN ('g', 'ml', 'count'));
