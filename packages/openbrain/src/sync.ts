import { upsertThought } from './client.js';
import type { CookLogEntry, InventorySnapshot, MealPlanPayload, RecipePayload, SyncResult } from './types.js';

function recipeExternalId(recipeId: string): string {
  return `eat-thing:recipe:${recipeId}`;
}

function inventoryExternalId(householdId: string): string {
  return `eat-thing:inventory:${householdId}`;
}

function mealPlanExternalId(mealPlanId: string): string {
  return `eat-thing:meal-plan:${mealPlanId}`;
}

function cookLogExternalId(householdId: string, date: string): string {
  return `eat-thing:cook-log:${householdId}:${date}`;
}

export async function syncRecipe(recipe: RecipePayload): Promise<SyncResult> {
  try {
    const ingredients = recipe.ingredients
      .map(i => `- ${i.qty} ${i.unit} ${i.foodName}${i.optional ? ' (optional)' : ''}`)
      .join('\n');

    const content = [
      `# Recipe: ${recipe.name}`,
      `Servings: ${recipe.servings}`,
      recipe.sourceUrl ? `Source: ${recipe.sourceUrl}` : '',
      '',
      '## Ingredients',
      ingredients,
      recipe.instructions ? '\n## Instructions\n' + recipe.instructions : '',
    ].filter(Boolean).join('\n');

    await upsertThought(recipeExternalId(recipe.id), content);
    return { ok: true };
  } catch (err) {
    console.error('syncRecipe failed', err);
    return { ok: false, error: String(err) };
  }
}

export async function syncInventorySnapshot(snapshot: InventorySnapshot): Promise<SyncResult> {
  try {
    const items = snapshot.items
      .map(i => `- ${i.foodName}: ${i.qty} ${i.unit}${i.brand ? ` (${i.brand})` : ''}${i.location ? ` [${i.location}]` : ''}${i.expiresAt ? ` expires ${i.expiresAt}` : ''}`)
      .join('\n');

    const content = `# Inventory snapshot (${snapshot.snapshotAt})\n\n${items || '(empty)'}`;
    await upsertThought(inventoryExternalId(snapshot.householdId), content);
    return { ok: true };
  } catch (err) {
    console.error('syncInventorySnapshot failed', err);
    return { ok: false, error: String(err) };
  }
}

export async function syncMealPlan(plan: MealPlanPayload): Promise<SyncResult> {
  try {
    const entries = plan.entries
      .map(e => `- ${e.date}: ${e.recipeName} (${e.servings} servings) [${e.status}]`)
      .join('\n');

    const content = `# Meal plan: week of ${plan.weekStart}\n\n${entries || '(no meals planned)'}`;
    await upsertThought(mealPlanExternalId(plan.mealPlanId), content);
    return { ok: true };
  } catch (err) {
    console.error('syncMealPlan failed', err);
    return { ok: false, error: String(err) };
  }
}

export async function syncCookLog(log: CookLogEntry): Promise<SyncResult> {
  try {
    const events = log.events
      .map(e => `- Cooked ${e.recipeName} (${e.servings} servings) at ${e.cookedAt}`)
      .join('\n');

    const content = `# Cook log: ${log.date}\n\n${events || '(no cook events)'}`;
    await upsertThought(cookLogExternalId(log.householdId, log.date), content);
    return { ok: true };
  } catch (err) {
    console.error('syncCookLog failed', err);
    return { ok: false, error: String(err) };
  }
}
