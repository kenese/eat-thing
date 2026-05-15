import { Router, type Router as ExpressRouter } from 'express';
import { ilike, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { canonicalFoods } from '../db/schema/index.js';
import { withHousehold } from '../middleware/with-household.js';

const router: ExpressRouter = Router();

// GET /api/foods?q=flour&limit=20
// Returns canonical foods matching the search query. No auth required — it's a reference list.
router.get('/', async (req, res) => {
  try {
    const { q, limit } = req.query as { q?: string; limit?: string };
    const maxRows = Math.min(parseInt(limit ?? '50', 10) || 50, 100);

    const rows = await db
      .select({
        id: canonicalFoods.id,
        name: canonicalFoods.name,
        defaultUnit: canonicalFoods.defaultUnit,
        aliases: canonicalFoods.aliases,
        densityGPerMl: canonicalFoods.densityGPerMl,
        countToGrams: canonicalFoods.countToGrams,
      })
      .from(canonicalFoods)
      .where(q?.trim() ? ilike(canonicalFoods.name, `%${q.trim()}%`) : undefined)
      .orderBy(asc(canonicalFoods.name))
      .limit(maxRows);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/foods — create a new canonical food entry (called during recipe import resolution)
router.post('/', withHousehold, async (req, res) => {
  const parse = z.object({
    name: z.string().min(1).max(120),
    defaultUnit: z.enum(['g', 'ml', 'count']).default('g'),
    category: z.enum(['produce', 'meat', 'dairy', 'pantry', 'frozen', 'drinks', 'other']).default('other'),
  }).safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? 'Invalid input' });
    return;
  }

  const { name, defaultUnit, category } = parse.data;
  const trimmed = name.trim();

  try {
    const [existing] = await db
      .select({ id: canonicalFoods.id, name: canonicalFoods.name, defaultUnit: canonicalFoods.defaultUnit, aliases: canonicalFoods.aliases, densityGPerMl: canonicalFoods.densityGPerMl, countToGrams: canonicalFoods.countToGrams })
      .from(canonicalFoods)
      .where(ilike(canonicalFoods.name, trimmed))
      .limit(1);

    if (existing) {
      res.status(200).json(existing);
      return;
    }

    const [created] = await db
      .insert(canonicalFoods)
      .values({ name: trimmed, defaultUnit, category, aliases: [] })
      .returning({ id: canonicalFoods.id, name: canonicalFoods.name, defaultUnit: canonicalFoods.defaultUnit, aliases: canonicalFoods.aliases, densityGPerMl: canonicalFoods.densityGPerMl, countToGrams: canonicalFoods.countToGrams });

    res.status(201).json(created);
  } catch (err) {
    console.error('[POST /api/foods]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
