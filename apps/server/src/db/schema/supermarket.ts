import { pgTable, uuid, text, timestamp, numeric, boolean, unique } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { canonicalFoods } from './foods.js';
import { storeEnum } from './enums.js';

export const supermarketCredentials = pgTable('supermarket_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  store: storeEnum('store').notNull(),
  encryptedSessionBlob: text('encrypted_session_blob'), // AES-256 encrypted cookie blob; key lives on server only
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, t => [unique().on(t.householdId, t.store)]);

export const supermarketProducts = pgTable('supermarket_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  store: storeEnum('store').notNull(),
  sku: text('sku').notNull(),
  canonicalFoodId: uuid('canonical_food_id').references(() => canonicalFoods.id),
  brand: text('brand'),
  name: text('name').notNull(),
  lastSeenPrice: numeric('last_seen_price', { precision: 10, scale: 2 }),
  preferred: boolean('preferred').notNull().default(false), // derived from past-order history
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
}, t => [unique().on(t.householdId, t.store, t.sku)]);
