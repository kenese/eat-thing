export * from './convert.js';
export * from './seed.js';

// ─── Food categories (broad sections used by shopping list grouping) ───
export const CATEGORIES = ['produce', 'meat', 'dairy', 'pantry', 'frozen', 'drinks', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  produce: 'Fruit & veg',
  meat:    'Meat & fish',
  dairy:   'Dairy & eggs',
  pantry:  'Pantry & dry goods',
  frozen:  'Frozen',
  drinks:  'Drinks',
  other:   'Other',
};

export const CATEGORY_ORDER: Category[] = [
  'produce', 'meat', 'dairy', 'pantry', 'frozen', 'drinks', 'other',
];

// Aisle-display names — warmer vocabulary for shopping list and home preview.
// Keep distinct from CATEGORY_LABEL (used in inventory forms / taxonomy UI).
export const AISLE_LABEL: Record<Category, string> = {
  produce: 'Produce',
  meat:    'Butcher',
  dairy:   'Dairy & cheese',
  pantry:  'Pantry & oils',
  frozen:  'Frozen',
  drinks:  'Drinks',
  other:   'Other',
};
