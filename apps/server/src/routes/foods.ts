import { Router, type Router as ExpressRouter } from 'express';
import { ilike, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { canonicalFoods } from '../db/schema/index.js';

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

export default router;
