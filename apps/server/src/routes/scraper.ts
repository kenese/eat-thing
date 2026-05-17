import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { and, eq, desc, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { ProductCandidate } from '@eat/shared';
import { db } from '../db/index.js';
import {
  supermarketCredentials, supermarketProducts,
  scraperJobs, shoppingListPrices, shoppingListItems,
  canonicalFoods, memberships,
} from '../db/schema/index.js';
import { auth } from '../auth.js';
import { fromNodeHeaders } from 'better-auth/node';

const router: ExpressRouter = Router();

function withWorkerAuth(req: Request, res: Response, next: NextFunction) {
  const key = process.env.SCRAPER_HMAC_SECRET;
  if (!key) { res.status(500).json({ error: 'WORKER_HMAC_KEY not configured' }); return; }

  const timestamp = req.headers['x-worker-timestamp'] as string;
  const signature = req.headers['x-worker-signature'] as string;
  if (!timestamp || !signature) { res.status(401).json({ error: 'Missing HMAC headers' }); return; }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    res.status(401).json({ error: 'Timestamp too old' });
    return;
  }

  const fullPath = req.originalUrl.split('?')[0];
  const body = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
  const expected = crypto.createHmac('sha256', key).update(`${req.method}\n${fullPath}\n${timestamp}\n${body}`).digest('hex');
  try {
    const valid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    if (!valid) { res.status(401).json({ error: 'Invalid signature' }); return; }
  } catch {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
}

// ─── Session endpoints (HMAC) ────────────────────────────────────────────────

router.post('/session', withWorkerAuth, async (req, res) => {
  const { householdId, store, encryptedBlob } = req.body as {
    householdId?: string; store?: string; encryptedBlob?: string;
  };
  if (!householdId || !store || !encryptedBlob) {
    res.status(400).json({ error: 'householdId, store, encryptedBlob required' });
    return;
  }

  try {
    await db
      .insert(supermarketCredentials)
      .values({ householdId, store: store as 'new_world' | 'paknsave' | 'woolworths', encryptedSessionBlob: encryptedBlob, lastLoginAt: new Date() })
      .onConflictDoUpdate({
        target: [supermarketCredentials.householdId, supermarketCredentials.store],
        set: { encryptedSessionBlob: encryptedBlob, lastLoginAt: new Date(), updatedAt: new Date() },
      });
    res.json({ ok: true });
  } catch (err) {
    console.error('[scraper] POST /session', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/session/:householdId/:store', withWorkerAuth, async (req, res) => {
  const { householdId, store } = req.params as { householdId: string; store: string };
  try {
    const rows = await db
      .select({
        encryptedSessionBlob: supermarketCredentials.encryptedSessionBlob,
        lastLoginAt: supermarketCredentials.lastLoginAt,
      })
      .from(supermarketCredentials)
      .where(and(eq(supermarketCredentials.householdId, householdId), eq(supermarketCredentials.store, store as 'new_world' | 'paknsave' | 'woolworths')))
      .limit(1);

    if (rows.length === 0 || !rows[0]?.encryptedSessionBlob) {
      res.status(404).json({ error: 'No session for this store' });
      return;
    }
    res.json({
      encryptedBlob: rows[0].encryptedSessionBlob,
      lastLoginAt: rows[0].lastLoginAt ? rows[0].lastLoginAt.toISOString() : null,
    });
  } catch (err) {
    console.error('[scraper] GET /session', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Job lifecycle (HMAC) ────────────────────────────────────────────────────

router.get('/jobs/pending', withWorkerAuth, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: scraperJobs.id,
        householdId: scraperJobs.householdId,
        store: scraperJobs.store,
        type: scraperJobs.type,
        payload: scraperJobs.payload,
        status: scraperJobs.status,
        attempts: scraperJobs.attempts,
        createdAt: scraperJobs.createdAt,
      })
      .from(scraperJobs)
      .where(eq(scraperJobs.status, 'pending'))
      .orderBy(scraperJobs.createdAt)
      .limit(10);

    res.json({
      jobs: rows.map(r => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })),
    });
  } catch (err) {
    console.error('[scraper] GET /jobs/pending', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/jobs/:id/claim', withWorkerAuth, async (req, res) => {
  const id = req.params['id'] as string;
  try {
    const result = await db
      .update(scraperJobs)
      .set({ status: 'in_progress', claimedAt: new Date(), attempts: sql`${scraperJobs.attempts} + 1` })
      .where(and(eq(scraperJobs.id, id), eq(scraperJobs.status, 'pending')))
      .returning();
    if (result.length === 0) {
      res.status(409).json({ error: 'Job not in pending state' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[scraper] POST /jobs/:id/claim', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/jobs/:id/result', withWorkerAuth, async (req, res) => {
  const id = req.params['id'] as string;
  const { ok, data, error } = req.body as { ok?: boolean; data?: Record<string, unknown>; error?: string };
  if (typeof ok !== 'boolean') { res.status(400).json({ error: 'ok (boolean) required' }); return; }

  try {
    const jobRows = await db
      .select({ id: scraperJobs.id, type: scraperJobs.type, householdId: scraperJobs.householdId, store: scraperJobs.store })
      .from(scraperJobs)
      .where(eq(scraperJobs.id, id))
      .limit(1);
    if (jobRows.length === 0) { res.status(404).json({ error: 'Job not found' }); return; }
    const job = jobRows[0]!;

    if (ok && data) {
      if (job.type === 'compare_prices') {
        await applyComparePricesResult(job.store, data);
      } else if (job.type === 'import_past_orders') {
        await applyImportPastOrdersResult(job.householdId, job.store, data);
      } else if (job.type === 'add_to_cart') {
        // No DB writes beyond the job row itself — result captured in job.result
      }
    }

    await db
      .update(scraperJobs)
      .set({
        status: ok ? 'done' : 'failed',
        result: ok ? data ?? null : null,
        error: ok ? null : (error ?? 'unknown'),
        completedAt: new Date(),
      })
      .where(eq(scraperJobs.id, id));

    res.json({ ok: true });
  } catch (err) {
    console.error('[scraper] POST /jobs/:id/result', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface ComparePricesItem {
  shoppingListItemId: string;
  candidates: ProductCandidate[];
  chosenSku: string | null;
}

async function applyComparePricesResult(store: string, data: Record<string, unknown>): Promise<void> {
  const items = (data['items'] ?? []) as ComparePricesItem[];
  if (items.length === 0) return;

  await db.transaction(async tx => {
    for (const item of items) {
      const chosen = item.chosenSku
        ? item.candidates.find(c => c.sku === item.chosenSku) ?? null
        : null;
      const mirror = chosen ?? item.candidates[0] ?? null;
      await tx
        .insert(shoppingListPrices)
        .values({
          shoppingListItemId: item.shoppingListItemId,
          store: store as 'new_world' | 'paknsave' | 'woolworths',
          sku: mirror?.sku ?? null,
          name: mirror?.name ?? null,
          price: mirror?.price !== undefined && mirror.price !== null ? String(mirror.price) : null,
          inStock: mirror?.inStock ?? true,
          matched: !!mirror,
          candidates: item.candidates,
          chosenSku: item.chosenSku,
          checkedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [shoppingListPrices.shoppingListItemId, shoppingListPrices.store],
          set: {
            sku: mirror?.sku ?? null,
            name: mirror?.name ?? null,
            price: mirror?.price !== undefined && mirror.price !== null ? String(mirror.price) : null,
            inStock: mirror?.inStock ?? true,
            matched: !!mirror,
            candidates: item.candidates,
            chosenSku: item.chosenSku,
            checkedAt: new Date(),
          },
        });
    }
  });
}

interface ImportPastOrdersProduct {
  sku: string;
  name: string;
  brand: string | null;
  canonicalFoodHint: string | null;
}

async function applyImportPastOrdersResult(householdId: string, store: string, data: Record<string, unknown>): Promise<void> {
  const products = (data['products'] ?? []) as ImportPastOrdersProduct[];
  if (products.length === 0) return;

  await db.transaction(async tx => {
    for (const p of products) {
      let canonicalFoodId: string | null = null;
      if (p.canonicalFoodHint) {
        const hits = await tx
          .select({ id: canonicalFoods.id })
          .from(canonicalFoods)
          .where(eq(canonicalFoods.name, p.canonicalFoodHint))
          .limit(1);
        canonicalFoodId = hits[0]?.id ?? null;
      }
      await tx
        .insert(supermarketProducts)
        .values({
          householdId,
          store: store as 'new_world' | 'paknsave' | 'woolworths',
          sku: p.sku,
          canonicalFoodId,
          brand: p.brand,
          name: p.name,
          preferred: true,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [supermarketProducts.householdId, supermarketProducts.store, supermarketProducts.sku],
          set: { name: p.name, brand: p.brand, preferred: true, lastSeenAt: new Date() },
        });
    }
  });
}

// ─── Import past orders (user-auth) ──────────────────────────────────────────

router.post('/import-past-orders', async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const memb = await db.select({ householdId: memberships.householdId }).from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  const householdId = memb[0]?.householdId;
  if (!householdId) { res.status(403).json({ error: 'No household' }); return; }

  const { store } = req.body as { store?: string };
  if (store !== 'new_world' && store !== 'paknsave' && store !== 'woolworths') {
    res.status(400).json({ error: 'store required (new_world | paknsave | woolworths)' });
    return;
  }

  try {
    const inserted = await db
      .insert(scraperJobs)
      .values({ householdId, store, type: 'import_past_orders', status: 'pending' })
      .returning({ id: scraperJobs.id });

    res.json({ jobId: inserted[0]?.id });
  } catch (err) {
    console.error('[scraper] POST /import-past-orders', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
