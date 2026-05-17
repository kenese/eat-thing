import {Router, type Router as ExpressRouter} from 'express';
import {z} from 'zod';
import {eq} from 'drizzle-orm';
import {withHousehold} from '../middleware/with-household.js';
import {extractFromUrl} from '../lib/recipe-extractor.js';
import {extractFromPhoto} from '../lib/photo-extractor.js';
import {searchMealDb} from '../lib/themealdb.js';
import {listMealPlannerRecipes, parseMealPlannerRecipe} from '../lib/meal-planner-importer.js';
import {db} from '../db/index.js';
import {recipes} from '../db/schema/index.js';

interface ApiError extends Error {
    status: number;
}

const router: ExpressRouter = Router();

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type ImageMimeType = typeof IMAGE_MIME_TYPES[number];

// POST /api/ingest/url
router.post('/url', withHousehold, async (req, res) => {
    const parse = z.object({url: z.string().url()}).safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({error: 'Invalid URL'});
        return;
    }

    try {
        const recipe = await extractFromUrl(parse.data.url);
        res.json(recipe);
    } catch (err: unknown) {
        console.error('[ingest/url]', err);

        res.status(err instanceof Error && 'status' in err ? err.status as number : 500).json({
            message: err instanceof Error ? err.message : 'Internal Server Error: Extraction failed',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }
});

// POST /api/ingest/photo
router.post('/photo', withHousehold, async (req, res) => {
    const parse = z.object({
        imageBase64: z.string().min(1),
        mimeType: z.enum(IMAGE_MIME_TYPES),
    }).safeParse(req.body);

    if (!parse.success) {
        res.status(400).json({error: 'Requires imageBase64 and mimeType'});
        return;
    }

    try {
        const recipe = await extractFromPhoto(parse.data.imageBase64, parse.data.mimeType as ImageMimeType);
        res.json(recipe);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Photo extraction failed';
        console.error('[ingest/photo]', err);
        res.status(422).json({error: msg});
    }
});

// GET /api/ingest/search?q=chicken
router.get('/search', withHousehold, async (req, res) => {
    const q = String(req.query['q'] ?? '').trim();
    if (!q) {
        res.status(400).json({error: 'Query required'});
        return;
    }

    try {
        const results = await searchMealDb(q);
        res.json(results);
    } catch (err) {
        console.error('[ingest/search]', err);
        res.status(502).json({error: 'Search failed'});
    }
});

// GET /api/ingest/meal-planner — list structured recipes from Meal Planner
router.get('/meal-planner', withHousehold, async (req, res) => {
    try {
        const rows = await db
            .select({name: recipes.name})
            .from(recipes)
            .where(eq(recipes.householdId, req.householdId));
        const existingNames = new Set(rows.map(r => r.name.toLowerCase()));

        const previews = await listMealPlannerRecipes(existingNames);
        res.json(previews);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to list Meal Planner recipes';
        console.error('[ingest/meal-planner]', err);
        res.status(502).json({error: msg});
    }
});

// POST /api/ingest/meal-planner/parse — parse a specific Meal Planner recipe into a structured recipe draft
router.post('/meal-planner/parse', withHousehold, async (req, res) => {
    const parse = z.object({id: z.string().min(1)}).safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({error: 'id is required'});
        return;
    }

    try {
        const recipe = await parseMealPlannerRecipe(parse.data.id);
        res.json(recipe);
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to parse Meal Planner recipe';
        console.error('[ingest/meal-planner/parse]', err);
        res.status(422).json({error: msg});
    }
});

export default router;
