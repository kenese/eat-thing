import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useInventory } from '../../hooks/useInventory';
import { useMealPlanEntries } from '../../hooks/useMealPlan';
import { useCurrentShoppingList } from '../../hooks/useShoppingList';
import { usePricesForList } from '../../hooks/usePricesForList';
import { api } from '../../api/client';
import { planWindow, planWindowDays } from '../../lib/dateUtils';
import type { PlanWindowDay } from '../../lib/dateUtils';
import {
  computeMeals,
  computeExpiring,
  computeShopSummary,
  coveragePill,
  subcopyDay,
  type ExpiringSummary,
  type MealCellStatus,
  type ShopSummary,
} from './homeDerivations';
import { computeMissing } from '../../lib/recipeMatch';
import type { DayEntry, DayKind } from '../../lib/planTypes';
import type { Recipe } from '@eat/shared';

export interface HomeData {
  hero: {
    pill: string | null;
    onHandCount: number;
    expiringSoonCount: number;
    expirySubcopyDay: string;
  };
  meals: MealCellStatus[];
  expiring: ExpiringSummary;
  shop: ShopSummary;
  planDays: PlanWindowDay[];
  entriesByDay: Record<string, DayEntry[]>;
  loading: { inventory: boolean; mealPlan: boolean; recipes: boolean; shopping: boolean };
  errors:  { inventory: boolean; mealPlan: boolean; recipes: boolean; shopping: boolean };
}

export function useHomeData(now: Date = new Date()): HomeData {
  const { from, to } = useMemo(() => planWindow(now), [now]);

  const inventoryQ = useInventory();
  const mealPlanQ  = useMealPlanEntries(from, to);
  const shopListQ  = useCurrentShoppingList();
  const pricesQ    = usePricesForList(shopListQ.data?.id ?? null);

  const entries = mealPlanQ.data?.entries ?? [];

  const uniqueRecipeIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.recipeId);
    return [...set];
  }, [entries]);

  const recipeQueries = useQueries({
    queries: uniqueRecipeIds.map((id) => ({
      queryKey: ['recipe', id],
      queryFn: () => api.get<Recipe>(`/api/recipes/${id}`),
      enabled: !!id,
    })),
  });

  const recipesById: Record<string, Recipe> = useMemo(() => {
    const map: Record<string, Recipe> = {};
    recipeQueries.forEach((q, i) => {
      if (q.data) map[uniqueRecipeIds[i]] = q.data;
    });
    return map;
  }, [recipeQueries, uniqueRecipeIds]);

  const inventory = inventoryQ.data ?? [];
  const meals = computeMeals(entries, recipesById, inventory, now);
  const expiring = computeExpiring(inventory, now);
  const shop = computeShopSummary(shopListQ.data ?? null, pricesQ.data?.prices ?? [], now);

  const planDays = useMemo(() => planWindowDays(now), [now]);

  const entriesByDay = useMemo<Record<string, DayEntry[]>>(() => {
    const map: Record<string, DayEntry[]> = {};
    for (const e of entries) {
      const full = recipesById[e.recipeId];
      const missingNames = full ? computeMissing(full, inventory) : [];
      const kind: DayKind = e.status === 'cooked' ? 'cook' : missingNames.length > 0 ? 'shop' : 'cook';
      (map[e.date] ??= []).push({
        entry: e,
        missingNames,
        kind,
        totalTimeMinutes: full?.totalTimeMinutes ?? null,
        sourceImage: full?.sourceImage ?? null,
      });
    }
    return map;
  }, [entries, recipesById, inventory]);

  return {
    hero: {
      pill: coveragePill(meals),
      onHandCount: inventory.length,
      expiringSoonCount: expiring.totalCount,
      expirySubcopyDay: subcopyDay(expiring, now),
    },
    meals,
    expiring,
    shop,
    planDays,
    entriesByDay,
    loading: {
      inventory: inventoryQ.isLoading,
      mealPlan:  mealPlanQ.isLoading,
      recipes:   recipeQueries.some((q) => q.isLoading),
      shopping:  shopListQ.isLoading,
    },
    errors: {
      inventory: !!inventoryQ.error,
      mealPlan:  !!mealPlanQ.error,
      recipes:   recipeQueries.some((q) => !!q.error),
      shopping:  !!shopListQ.error,
    },
  };
}
