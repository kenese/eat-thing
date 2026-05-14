ALTER TABLE "canonical_foods" ADD COLUMN "count_to_grams" double precision;
--> statement-breakpoint
UPDATE "canonical_foods"
SET "count_to_grams" = CASE "name"
  WHEN 'garlic' THEN 5
  WHEN 'onion' THEN 150
  WHEN 'red onion' THEN 130
  WHEN 'spring onion' THEN 15
  WHEN 'chili' THEN 15
  WHEN 'lemon' THEN 120
  WHEN 'lime' THEN 70
  WHEN 'capsicum' THEN 160
  WHEN 'tomato' THEN 130
  WHEN 'corn' THEN 250
  WHEN 'cucumber' THEN 300
  WHEN 'avocado' THEN 200
  WHEN 'eggs' THEN 60
  WHEN 'bread' THEN 35
  WHEN 'tortilla' THEN 40
  WHEN 'pita bread' THEN 60
  WHEN 'banana' THEN 120
  WHEN 'apple' THEN 180
  WHEN 'mango' THEN 300
  ELSE "count_to_grams"
END
WHERE "name" IN (
  'garlic',
  'onion',
  'red onion',
  'spring onion',
  'chili',
  'lemon',
  'lime',
  'capsicum',
  'tomato',
  'corn',
  'cucumber',
  'avocado',
  'eggs',
  'bread',
  'tortilla',
  'pita bread',
  'banana',
  'apple',
  'mango'
);
