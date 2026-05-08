import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { households } from './households.js';

// One row per dirty resource. The sync worker claims unclaimed rows whose
// dirty_since is older than the debounce window (~5 min), writes a snapshot
// to OpenBrain, then deletes the row. A new mutation during processing
// re-inserts it, ensuring the next sync cycle picks up the latest state.
export const syncDirty = pgTable('sync_dirty', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  resourceType: text('resource_type').notNull(), // 'inventory' | 'meal_plan'
  resourceId: uuid('resource_id').notNull(),     // householdId for inventory, mealPlanId for meal_plan
  dirtySince: timestamp('dirty_since').notNull().defaultNow(),
  claimedAt: timestamp('claimed_at'),            // null = unclaimed; set by worker to prevent double-processing
}, t => [unique().on(t.householdId, t.resourceType, t.resourceId)]);
