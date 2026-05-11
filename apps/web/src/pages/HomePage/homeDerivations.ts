import type {
  InventoryRow,
  MealPlanEntry,
  Recipe,
  ShoppingList,
  ShoppingListPrice,
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

// ─── Coverage pill ──────────────────────────────────────────────────────────

// Long day names indexed by Date.getDay() (0 = Sunday).
const LONG_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

// Map short label ('mon') used in MealCellStatus to long ('monday').
const SHORT_TO_LONG: Record<string, string> = {
  sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday',
  thu: 'thursday', fri: 'friday', sat: 'saturday',
};

export function coveragePill(meals: MealCellStatus[]): string | null {
  if (meals.length === 0 || meals[0].kind !== 'cook') return null;

  let runEnd = 0;
  for (let i = 0; i < meals.length; i++) {
    if (meals[i].kind === 'cook') runEnd = i;
    else break;
  }
  const first = SHORT_TO_LONG[meals[0].dayLabel] ?? meals[0].dayLabel;
  if (runEnd === 0) return `you have what you need for ${first}`;
  const last = SHORT_TO_LONG[meals[runEnd].dayLabel] ?? meals[runEnd].dayLabel;
  return `you have what you need for ${first} & ${last}`;
}

export { LONG_DAYS };

// ─── Sub-copy ───────────────────────────────────────────────────────────────

export function subcopyDay(today: Date): string {
  const d = new Date(today);
  d.setDate(d.getDate() + 3);
  return LONG_DAYS[d.getDay()];
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

// ─── Shop summary ────────────────────────────────────────────────────────────

function formatBuiltLabel(createdAt: string): string {
  // createdAt comes either as ISO with Z or as a naive local string. Date handles both.
  const d = new Date(createdAt);
  const dow = SHORT_DAYS[d.getDay()];
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 || 12;
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours24 < 12 ? 'am' : 'pm';
  return `built ${dow} ${hours12}:${mins} ${ampm}`;
}

export function computeShopSummary(
  list: ShoppingList | null,
  prices: ShoppingListPrice[],
  _today: Date,
): ShopSummary {
  if (!list || list.items.length === 0) {
    return { state: 'empty', total: null, builtLabel: null, aisles: [] };
  }

  // Group by category, count, collect first 3 sample names.
  const byCat = new Map<Category, { count: number; sample: string[] }>();
  for (const it of list.items) {
    const bucket = byCat.get(it.category) ?? { count: 0, sample: [] };
    bucket.count += 1;
    if (bucket.sample.length < 3) bucket.sample.push(it.name);
    byCat.set(it.category, bucket);
  }
  const aisles: AisleSummary[] = [...byCat.entries()]
    .map(([name, v]) => ({ name, sampleItems: v.sample, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // Total = Σ price × qty for unchecked items, only if any price exists.
  const priceByItem = new Map(prices.map((p) => [p.shoppingListItemId, p.price]));
  let total = 0;
  let anyPrice = false;
  for (const it of list.items) {
    if (it.checked) continue;
    const price = priceByItem.get(it.id);
    if (price != null) {
      total += price * it.qty;
      anyPrice = true;
    }
  }

  return {
    state: 'ready',
    total: anyPrice ? Math.round(total * 100) / 100 : null,
    builtLabel: formatBuiltLabel(list.createdAt),
    aisles,
  };
}
