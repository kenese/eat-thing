import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useInventory } from '../../hooks/useInventory';
import { useMealPlanEntries } from '../../hooks/useMealPlan';
import { useCurrentShoppingList } from '../../hooks/useShoppingList';
import { usePricesForList } from '../../hooks/usePricesForList';
import { api } from '../../api/client';
import { planWindow } from '../../lib/dateUtils';
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
