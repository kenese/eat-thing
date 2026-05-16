-- Drop the OpenBrain sync queue table
DROP TABLE IF EXISTS "sync_dirty";

-- Drop the synced flag from inventory_items (was flipped by the daily OpenBrain roll-up worker)
ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "synced";
