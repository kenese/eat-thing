import 'dotenv/config';
import crypto from 'node:crypto';
import {
  syncInventorySnapshot, syncMealPlan,
} from '@eat/openbrain';

const API_BASE = process.env.API_BASE_URL ?? 'https://your-app.vercel.app';
const HMAC_KEY = process.env.WORKER_HMAC_KEY ?? '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '60000', 10);

function signedHeaders(method: string, path: string, body = ''): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', HMAC_KEY).update(`${method}\n${path}\n${timestamp}\n${body}`).digest('hex');
  return { 'X-Worker-Timestamp': timestamp, 'X-Worker-Signature': sig, 'Content-Type': 'application/json' };
}

async function workerFetch(method: string, path: string, body?: unknown) {
  const bodyStr = body ? JSON.stringify(body) : '';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: signedHeaders(method, path, bodyStr),
    body: bodyStr || undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

async function processJob(job: { id: string; householdId: string; resourceType: string; resourceId: string }) {
  await workerFetch('POST', `/api/sync/claim/${job.id}`);

  try {
    if (job.resourceType === 'inventory') {
      const snapshot = await workerFetch('GET', `/api/sync/snapshot/inventory?householdId=${job.householdId}`);
      await syncInventorySnapshot(snapshot);
    } else if (job.resourceType === 'meal_plan') {
      const snapshot = await workerFetch('GET', `/api/sync/snapshot/meal-plan?householdId=${job.householdId}&mealPlanId=${job.resourceId}`);
      await syncMealPlan(snapshot);
    }

    await workerFetch('POST', `/api/sync/complete/${job.id}`);
    console.log(`[sync] completed ${job.resourceType}:${job.resourceId}`);
  } catch (err) {
    console.error(`[sync] failed ${job.resourceType}:${job.resourceId}`, err);
  }
}

async function pollOnce() {
  try {
    const { jobs } = await workerFetch('GET', '/api/sync/pending');
    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err) {
    console.error('[sync] poll failed', err);
  }
}

console.log(`[sync] OpenBrain sync worker starting. Poll interval: ${POLL_INTERVAL_MS}ms`);
pollOnce();
setInterval(pollOnce, POLL_INTERVAL_MS);
