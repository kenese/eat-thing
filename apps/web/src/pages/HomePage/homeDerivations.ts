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

// ─── Meals ──────────────────────────────────────────────────────────────────

const SHORT_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeMeals(
  entries: MealPlanEntry[],
  recipesById: Record<string, Recipe>,
  inventory: InventoryRow[],
  today: Date,
): MealCellStatus[] {
  const cells: MealCellStatus[] = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const iso = isoDate(date);
    const dayLabel = SHORT_DAYS[date.getDay()];
    const isToday = i === 0;

    const dayEntry = entries.find((e) => e.date === iso);
    if (!dayEntry) {
      cells.push({ kind: 'open', isToday, dayLabel });
      continue;
    }

    const recipe = recipesById[dayEntry.recipeId];
    if (!recipe) {
      // Still loading the full recipe — fall back to open rather than guess.
      cells.push({ kind: 'open', isToday, dayLabel });
      continue;
    }

    const missing = computeMissing(recipe, inventory);
    if (missing.length === 0) {
      cells.push({
        kind: 'cook',
        recipe: { id: recipe.id, name: recipe.name },
        isToday,
        dayLabel,
      });
    } else {
      cells.push({
        kind: 'shop',
        recipe: { id: recipe.id, name: recipe.name },
        missingCount: missing.length,
        isToday,
        dayLabel,
      });
    }
  }
  return cells;
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
