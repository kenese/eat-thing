import {Router, type Router as ExpressRouter} from 'express';
import {z} from 'zod';
import {eq} from 'drizzle-orm';
import {withHousehold} from '../middleware/with-household.js';
import {extractFromUrl, resolveHeroImage} from '../lib/recipe-extractor.js';
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

        const status = err instanceof Error && 'status' in err ? err.status as number : 422;
        const message = err instanceof Error ? err.message : 'Extraction failed';

        res.status(status).json({
            message,
            error: message,
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

// POST /api/ingest/hero-image
router.post('/hero-image', withHousehold, async (req, res) => {
    const parse = z.object({url: z.string().url()}).safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({error: 'Valid URL required'});
        return;
    }

    const {url} = parse.data;

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        const response = await fetch(url, {headers, signal: AbortSignal.timeout(15_000)});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentType = response.headers.get('content-type') ?? '';

        if (contentType.startsWith('image/')) {
            // Direct image URL — just proxy it back as base64
            const mimeType = contentType.split(';')[0].trim();
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            res.json({base64, mimeType});
            return;
        }

        // HTML page — extract hero image URL from og:image / twitter:image
        const html = await response.text();
        const heroImageUrl = resolveHeroImage(html, url);
        if (!heroImageUrl) {
            res.status(422).json({error: 'No image found on this page.'});
            return;
        }

        const imgRes = await fetch(heroImageUrl, {
            headers,
            signal: AbortSignal.timeout(10_000),
        });
        if (!imgRes.ok) throw new Error(`Image fetch failed: HTTP ${imgRes.status}`);

        const imgContentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
        const mimeType = imgContentType.split(';')[0].trim();
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        res.json({base64, mimeType});
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to extract image';
        console.error('[ingest/hero-image]', err);
        res.status(422).json({error: msg});
    }
});

export default router;
