import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, ilike, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { syncRecipe } from '@eat/openbrain';
import { uploadPhoto } from '../lib/supabase-storage.js';
import { db } from '../db/index.js';
import { recipes, recipeIngredients, canonicalFoods } from '../db/schema/index.js';

const router: ExpressRouter = Router();

const ingredientSchema = z.object({
  canonicalFoodId: z.string().uuid(),
  qty: z.number().positive(),
  unit: z.enum(['g', 'ml', 'count']),
  optional: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  servings: z.number().positive().max(100),
  sourceUrl: z.string().trim().url().nullable().optional(),
  sourceImage: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  ingredients: z.array(ingredientSchema).min(1),
  photoBase64: z.string().optional(),
  photoMimeType: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  servings: z.number().positive().max(100).optional(),
  sourceUrl: z.string().trim().url().nullable().optional(),
  sourceImage: z.string().nullable().optional(),
  instructions: z.string().nullable().optional(),
  ingredients: z.array(ingredientSchema).min(1).optional(),
  photoBase64: z.string().optional(),
  photoMimeType: z.string().optional(),
});

const ingredientCols = {
  id: recipeIngredients.id,
  recipeId: recipeIngredients.recipeId,
  canonicalFoodId: recipeIngredients.canonicalFoodId,
  foodName: canonicalFoods.name,
  qty: recipeIngredients.qty,
  unit: recipeIngredients.unit,
  optional: recipeIngredients.optional,
  sortOrder: recipeIngredients.sortOrder,
};

const ingredientJoinOn = sql`${recipeIngredients.canonicalFoodId} = ${canonicalFoods.id}`;

async function loadRecipeIngredients(recipeId: string) {
  return db
    .select(ingredientCols)
    .from(recipeIngredients)
    .innerJoin(canonicalFoods, ingredientJoinOn)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.sortOrder));
}

// GET /api/recipes?q=pasta
router.get('/', withHousehold, async (req, res) => {
  try {
    const { q } = req.query as { q?: string };

    const conditions = [eq(recipes.householdId, req.householdId)];
    if (q?.trim()) {
      conditions.push(ilike(recipes.name, `%${q.trim()}%`));
    }

    const rows = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        servings: recipes.servings,
        sourceUrl: recipes.sourceUrl,
        ingredientCount: sql<number>`(select count(*)::int from ${recipeIngredients} where ${recipeIngredients.recipeId} = ${recipes.id})`,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
      })
      .from(recipes)
      .where(and(...conditions))
      .orderBy(asc(recipes.name));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/recipes/:id
router.get('/:id', withHousehold, async (req, res) => {
  const id = req.params['id'] as string;

  try {
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, id))
      .limit(1);

    if (!recipe) { res.status(404).json({ error: 'Recipe not found' }); return; }
    if (recipe.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    const ingredients = await loadRecipeIngredients(id);
    res.json({ ...recipe, ingredients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/recipes
router.post('/', withHousehold, async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }

  const { name, servings, sourceUrl, sourceImage, instructions, ingredients, photoBase64, photoMimeType } = parse.data;
  const recipeId = uuidv4();

  let resolvedImage: string | null = sourceImage ?? null;
  if (photoBase64 && photoMimeType) {
    try {
      resolvedImage = await uploadPhoto(photoBase64, photoMimeType);
    } catch (err) {
      console.error('[recipes] photo upload failed', err);
    }
  }

  try {
    await db.transaction(async tx => {
      await tx.insert(recipes).values({
        id: recipeId,
        householdId: req.householdId,
        name,
        servings,
        sourceUrl: sourceUrl ?? null,
        sourceImage: resolvedImage,
        instructions: instructions ?? null,
      });

      await tx.insert(recipeIngredients).values(
        ingredients.map((ing, idx) => ({
          id: uuidv4(),
          recipeId,
          householdId: req.householdId,
          canonicalFoodId: ing.canonicalFoodId,
          qty: ing.qty,
          unit: ing.unit,
          optional: ing.optional ?? false,
          sortOrder: idx,
        })),
      );
    });

    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
    const fullIngredients = await loadRecipeIngredients(recipeId);
    res.status(201).json({ ...recipe, ingredients: fullIngredients });
    syncRecipe({ id: recipe.id, name: recipe.name, servings: recipe.servings, sourceUrl: recipe.sourceUrl, instructions: recipe.instructions, ingredients: fullIngredients.map(i => ({ foodName: i.foodName, qty: i.qty, unit: i.unit, optional: i.optional })) })
      .catch(err => console.error('OpenBrain recipe sync failed', err));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/recipes/:id
router.put('/:id', withHousehold, async (req, res) => {
  const id = req.params['id'] as string;

  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }

  try {
    const [existing] = await db
      .select({ householdId: recipes.householdId })
      .from(recipes)
      .where(eq(recipes.id, id))
      .limit(1);

    if (!existing) { res.status(404).json({ error: 'Recipe not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    const d = parse.data;

    await db.transaction(async tx => {
      await tx
        .update(recipes)
        .set({
          ...(d.name !== undefined && { name: d.name }),
          ...(d.servings !== undefined && { servings: d.servings }),
          ...('sourceUrl' in d && { sourceUrl: d.sourceUrl ?? null }),
          ...('instructions' in d && { instructions: d.instructions ?? null }),
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, id));

      if (d.ingredients) {
        await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
        await tx.insert(recipeIngredients).values(
          d.ingredients.map((ing, idx) => ({
            id: uuidv4(),
            recipeId: id,
            householdId: req.householdId,
            canonicalFoodId: ing.canonicalFoodId,
            qty: ing.qty,
            unit: ing.unit,
            optional: ing.optional ?? false,
            sortOrder: idx,
          })),
        );
      }
    });

    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    const fullIngredients = await loadRecipeIngredients(id);
    res.json({ ...recipe, ingredients: fullIngredients });
    syncRecipe({ id: recipe.id, name: recipe.name, servings: recipe.servings, sourceUrl: recipe.sourceUrl, instructions: recipe.instructions, ingredients: fullIngredients.map(i => ({ foodName: i.foodName, qty: i.qty, unit: i.unit, optional: i.optional })) })
      .catch(err => console.error('OpenBrain recipe sync failed', err));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/recipes/:id
router.delete('/:id', withHousehold, async (req, res) => {
  const id = req.params['id'] as string;

  try {
    const [existing] = await db
      .select({ householdId: recipes.householdId })
      .from(recipes)
      .where(eq(recipes.id, id))
      .limit(1);

    if (!existing) { res.status(404).json({ error: 'Recipe not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    await db.delete(recipes).where(eq(recipes.id, id));
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
