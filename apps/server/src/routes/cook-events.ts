import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import { normalizeRecipeAmount } from '../lib/recipe-quantities.js';
import { subtractAmount } from '../lib/food-amounts.js';
import {
  mealPlanEntries, recipes, recipeIngredients,
  inventoryItems, canonicalFoods, cookEvents,
} from '../db/schema/index.js';
import type { CookDeduction, CookPrompt, CookEventPreview } from '@eat/shared';

const router: ExpressRouter = Router();

const deductionSchema = z.object({
  inventoryItemId: z.string().uuid(),
  canonicalFoodId: z.string().uuid(),
  foodName: z.string(),
  qty: z.number().positive(),
  unit: z.string().trim().min(1).max(40),
});

const promptResponseSchema = z.object({
  question: z.string(),
  answer: z.string(),
  inventoryItemId: z.string().uuid().optional(),
});

const createSchema = z.object({
  mealPlanEntryId: z.string().uuid().optional(),
  recipeId: z.string().uuid(),
  servings: z.number().positive(),
  deductions: z.array(deductionSchema),
  promptResponses: z.array(promptResponseSchema),
});

// GET /api/cook-events/preview?mealPlanEntryId=X  or  ?recipeId=X&servings=Y
router.get('/preview', withHousehold, async (req, res) => {
  const { mealPlanEntryId, recipeId: qRecipeId, servings: qServings } = req.query as Record<string, string>;

  if (!mealPlanEntryId && !qRecipeId) {
    res.status(400).json({ error: 'Provide mealPlanEntryId or recipeId + servings' });
    return;
  }

  try {
    let recipeId: string;
    let servings: number;
    let entryId: string | null = null;

    if (mealPlanEntryId) {
      const [entry] = await db
        .select({ recipeId: mealPlanEntries.recipeId, servings: mealPlanEntries.servings, householdId: mealPlanEntries.householdId })
        .from(mealPlanEntries)
        .where(eq(mealPlanEntries.id, mealPlanEntryId))
        .limit(1);
      if (!entry) { res.status(404).json({ error: 'Entry not found' }); return; }
      if (entry.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }
      recipeId = entry.recipeId;
      servings = entry.servings;
      entryId = mealPlanEntryId;
    } else {
      const parsedServings = parseFloat(qServings);
      if (!qRecipeId || isNaN(parsedServings) || parsedServings <= 0) {
        res.status(400).json({ error: 'recipeId and positive servings required' });
        return;
      }
      recipeId = qRecipeId;
      servings = parsedServings;
    }

    const [recipe] = await db
      .select({ id: recipes.id, servings: recipes.servings, householdId: recipes.householdId })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);
    if (!recipe || recipe.householdId !== req.householdId) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    const scalingRatio = recipe.servings > 0 ? servings / recipe.servings : 1;

    const ingredients = await db
      .select({
        canonicalFoodId: recipeIngredients.canonicalFoodId,
        foodName: canonicalFoods.name,
        qty: recipeIngredients.qty,
        unit: recipeIngredients.unit,
        densityGPerMl: canonicalFoods.densityGPerMl,
        countToGrams: canonicalFoods.countToGrams,
      })
      .from(recipeIngredients)
      .innerJoin(canonicalFoods, eq(recipeIngredients.canonicalFoodId, canonicalFoods.id))
      .where(and(eq(recipeIngredients.recipeId, recipeId), eq(recipeIngredients.optional, false)));

    const inventory = await db
      .select({
        id: inventoryItems.id,
        canonicalFoodId: inventoryItems.canonicalFoodId,
        qty: inventoryItems.qty,
        unit: inventoryItems.unit,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.householdId, req.householdId));

    const invByFood = new Map<string, typeof inventory>();
    for (const item of inventory) {
      const list = invByFood.get(item.canonicalFoodId) ?? [];
      list.push(item);
      invByFood.set(item.canonicalFoodId, list);
    }

    const deductions: CookDeduction[] = [];
    const prompts: CookPrompt[] = [];

    for (const ing of ingredients) {
      const amount = normalizeRecipeAmount(ing.qty, ing.unit);
      if (!amount) continue;
      const needed = amount.qty * scalingRatio;
      const invItems = invByFood.get(ing.canonicalFoodId) ?? [];

      if (invItems.length === 0) continue;

      const neededAmount = { qty: needed, unit: amount.unit };
      let matched = false;
      for (const item of invItems) {
        const subtraction = subtractAmount(item, neededAmount, ing);
        if (subtraction == null || subtraction.deductedQty <= 0.001) continue;
        deductions.push({
          inventoryItemId: item.id,
          canonicalFoodId: ing.canonicalFoodId,
          foodName: ing.foodName,
          qty: subtraction.deductedQty,
          unit: item.unit,
        });
        matched = true;
        break;
      }
      if (matched) {
        continue;
      }

      const item = invItems[0];
      prompts.push({
        question: `How much ${ing.foodName} will this recipe use? (your inventory has ${item.qty} ${item.unit})`,
        canonicalFoodId: ing.canonicalFoodId,
        foodName: ing.foodName,
        inventoryItemId: item.id,
        inventoryQty: item.qty,
        inventoryUnit: item.unit,
      });
    }

    const preview: CookEventPreview = { mealPlanEntryId: entryId, recipeId, servings, deductions, prompts };
    res.json(preview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/cook-events
router.post('/', withHousehold, async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  const { mealPlanEntryId, recipeId, servings, deductions, promptResponses } = parse.data;

  try {
    const [recipe] = await db
      .select({ householdId: recipes.householdId })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);
    if (!recipe || recipe.householdId !== req.householdId) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    if (mealPlanEntryId) {
      const [entry] = await db
        .select({ householdId: mealPlanEntries.householdId })
        .from(mealPlanEntries)
        .where(eq(mealPlanEntries.id, mealPlanEntryId))
        .limit(1);
      if (!entry || entry.householdId !== req.householdId) {
        res.status(404).json({ error: 'Meal plan entry not found' });
        return;
      }
    }

    const eventId = uuidv4();

    await db.transaction(async tx => {
      for (const d of deductions) {
        const [item] = await tx
          .select({ qty: inventoryItems.qty, householdId: inventoryItems.householdId })
          .from(inventoryItems)
          .where(eq(inventoryItems.id, d.inventoryItemId))
          .limit(1);

        if (!item || item.householdId !== req.householdId) continue;

        const newQty = Math.max(0, item.qty - d.qty);
        if (newQty <= 0.001) {
          await tx.delete(inventoryItems).where(eq(inventoryItems.id, d.inventoryItemId));
        } else {
          await tx
            .update(inventoryItems)
            .set({ qty: newQty, updatedAt: new Date() })
            .where(eq(inventoryItems.id, d.inventoryItemId));
        }
      }

      await tx.insert(cookEvents).values({
        id: eventId,
        householdId: req.householdId,
        mealPlanEntryId: mealPlanEntryId ?? null,
        cookedAt: new Date(),
        deductions: deductions,
        promptsResolved: promptResponses,
      });

      if (mealPlanEntryId) {
        await tx
          .update(mealPlanEntries)
          .set({ status: 'cooked' })
          .where(eq(mealPlanEntries.id, mealPlanEntryId));
      }
    });

    const [event] = await db
      .select({
        id: cookEvents.id,
        householdId: cookEvents.householdId,
        mealPlanEntryId: cookEvents.mealPlanEntryId,
        cookedAt: cookEvents.cookedAt,
        deductions: cookEvents.deductions,
        promptsResolved: cookEvents.promptsResolved,
      })
      .from(cookEvents)
      .where(eq(cookEvents.id, eventId));

    res.status(201).json(event);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
