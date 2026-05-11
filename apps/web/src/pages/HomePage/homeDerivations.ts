import type {
  InventoryRow,
  MealPlanEntry,
  Recipe,
  ShoppingList,
  CanonicalUnit,
  Category,
} from '@eat/shared';
import { computeMissing } from '../../lib/recipeMatch';

// ─── Display types ─────────────────────────────────────────────────────────

export interface ExpiringRow {
  id: string;
  name: string;
  qtyDisplay: string;
  daysLeft: number;
}

export interface ExpiringSummary {
  rows: ExpiringRow[];   // capped at 4
  totalCount: number;    // full count for the header tag
}

export type MealCellStatus =
  | { kind: 'cook'; recipe: { id: string; name: string }; isToday: boolean; dayLabel: string }
  | { kind: 'shop'; recipe: { id: string; name: string }; missingCount: number; isToday: boolean; dayLabel: string }
  | { kind: 'open'; isToday: boolean; dayLabel: string };

export interface AisleSummary {
  name: Category;
  sampleItems: string[]; // up to 3
  count: number;
}

export interface ShopSummary {
  state: 'ready' | 'empty';
  total: number | null;
  builtLabel: string | null;   // e.g. "built sun 9:14 am"
  aisles: AisleSummary[];      // up to 4 by count desc
}

// ─── Date helpers (local to derivations; the lib version handles ISO + monday) ──

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

function formatQty(qty: number, unit: CanonicalUnit): string {
  const rounded = Number.isInteger(qty) ? qty : Math.round(qty * 10) / 10;
  return `${rounded} ${unit}`;
}

// ─── Expiring ───────────────────────────────────────────────────────────────

export function computeExpiring(items: InventoryRow[], today: Date): ExpiringSummary {
  const withDates = items.filter((i) => i.expiresAt !== null);
  const all = withDates
    .map((i) => ({
      id: i.id,
      name: i.foodName,
      qtyDisplay: formatQty(i.qty, i.unit),
      daysLeft: daysBetween(today, new Date(i.expiresAt as string)),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
  return { rows: all.slice(0, 4), totalCount: all.length };
}
