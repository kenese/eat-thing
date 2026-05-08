import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import foodsRouter from './routes/foods.js';
import inventoryRouter from './routes/inventory.js';

const app: express.Express = express();

app.use(cors({
  origin: process.env.WEB_BASE_URL || 'http://localhost:5173',
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

export default app;
