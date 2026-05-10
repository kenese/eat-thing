import { pgTable, uuid, text, timestamp, numeric, boolean, unique, jsonb, integer } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { canonicalFoods } from './foods.js';
import { storeEnum } from './enums.js';

export const supermarketCredentials = pgTable('supermarket_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  store: storeEnum('store').notNull(),
  encryptedSessionBlob: text('encrypted_session_blob'), // base64 of (iv || authTag || ciphertext); key lives on the Mac mini only
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

export const scraperJobs = pgTable('scraper_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  store: storeEnum('store').notNull(),
  type: text('type').notNull(),
  payload: jsonb('payload'),
  status: text('status').notNull().default('pending'),
  result: jsonb('result'),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  claimedAt: timestamp('claimed_at'),
  completedAt: timestamp('completed_at'),
});
