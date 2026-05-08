// ─── Units & locations ──────────────────────────────────────────────────────

export type CanonicalUnit = 'g' | 'ml' | 'count';
export type InventoryLocation = 'fridge' | 'pantry' | 'freezer' | 'other';

// ─── Canonical foods ─────────────────────────────────────────────────────────

export interface CanonicalFood {
  id: string;
  name: string;
  defaultUnit: CanonicalUnit;
  aliases: string[];
  densityGPerMl: number | null;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryRow {
  id: string;
  householdId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: number;
  unit: CanonicalUnit;
  brand: string | null;
  location: InventoryLocation;
  purchasedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemInput {
  canonicalFoodId: string;
  qty: number;
  unit: CanonicalUnit;
  brand?: string | null;
  location?: InventoryLocation;
  purchasedAt?: string | null;
  expiresAt?: string | null;
}

export interface UpdateInventoryItemInput {
  qty?: number;
  unit?: CanonicalUnit;
  brand?: string | null;
  location?: InventoryLocation;
  purchasedAt?: string | null;
  expiresAt?: string | null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface Session {
  user: SessionUser;
  session: { id: string; userId: string; expiresAt: string };
}
