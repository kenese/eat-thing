import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import foodsRouter from './routes/foods.js';
import inventoryRouter from './routes/inventory.js';
import recipesRouter from './routes/recipes.js';
import mealPlansRouter from './routes/meal-plans.js';
import staplesRouter from './routes/staples.js';
import shoppingListsRouter from './routes/shopping-lists.js';
import cookEventsRouter from './routes/cook-events.js';
import syncRouter from './routes/sync.js';
import ingestRouter from './routes/ingest.js';
import scraperRouter from './routes/scraper.js';
import { getAllowedWebOrigins } from './auth-config.js';

const app: express.Express = express();

app.use(cors({
  origin: getAllowedWebOrigins(),
  credentials: true,
}));

// Better-Auth handles its own body parsing for auth routes
app.all('/api/auth/*', toNodeHandler(auth));

app.use(express.json());

// ─── Health ──────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ─── Domain routes ────────────────────────────────────────────────────────────

app.use('/api/foods', foodsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/meal-plans', mealPlansRouter);
app.use('/api/staples', staplesRouter);
app.use('/api/shopping-lists', shoppingListsRouter);
app.use('/api/cook-events', cookEventsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/scraper', scraperRouter);

export default app;
