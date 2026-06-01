import { pgTable, uuid, text, timestamp, numeric, boolean, unique, jsonb } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { shoppingListItems } from './shopping.js';
import { storeEnum } from './enums.js';

export const shoppingListPrices = pgTable('shopping_list_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  shoppingListItemId: uuid('shopping_list_item_id').notNull().references(() => shoppingListItems.id, { onDelete: 'cascade' }),
  store: storeEnum('store').notNull(),
  sku: text('sku'),
  name: text('name'),
  price: numeric('price', { precision: 10, scale: 2 }),
  inStock: boolean('in_stock').notNull().default(true),
  matched: boolean('matched').notNull().default(true),
  candidates: jsonb('candidates'),
  chosenSku: text('chosen_sku'),
  checkedAt: timestamp('checked_at').notNull().defaultNow(),
}, t => [unique().on(t.shoppingListItemId, t.store)]);
