import { pgEnum } from 'drizzle-orm/pg-core';

export const membershipRoleEnum = pgEnum('membership_role', ['owner', 'member']);
export const mealStatusEnum = pgEnum('meal_status', ['planned', 'cooked', 'skipped']);
export const shoppingSourceEnum = pgEnum('shopping_source', ['recipe', 'staple', 'manual']);
export const storeEnum = pgEnum('store', ['new_world', 'paknsave', 'woolworths']);
