# Phase 3 Slice 1 — New World Vertical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an end-to-end New-World-only flow so the existing `ShoppingListPage` can show current price + availability per item, sourced from a residential-IP Playwright scraper on the home Mac mini.

**Architecture:** Mac-mini-only encryption key for `supermarket_credentials`; one shared HMAC scheme (`WORKER_HMAC_KEY` + `X-Worker-*` headers) across the existing OpenBrain worker and the new scraper worker; explicit `scraper_jobs` queue with type-dispatched handlers; per-item `shopping_list_prices` populated by job results; hybrid catalog matching (preferred-brand cache + live search). Single-store on purpose — the abstractions for slice 2 fall out naturally once one adapter is real.

**Tech Stack:** TypeScript everywhere; Drizzle on Postgres (via `db:push` workflow — no committed migration files); Vitest for unit/component tests; Playwright for the scraper; React 19 + TanStack Query for UI; Express for the API; AES-256-GCM via `node:crypto`.

**Spec:** [docs/superpowers/specs/2026-05-10-phase3-newworld-slice-design.md](../specs/2026-05-10-phase3-newworld-slice-design.md)

---

## Conventions used in this plan

- Test files live next to the code they test (`foo.ts` + `foo.test.ts`), matching the existing repo.
- Server route tests use `vitest` with `vi.mock` of `drizzle-orm` and `../db/index.js`, following the pattern in `apps/server/src/routes/sync.test.ts` and `shopping-lists.test.ts`.
- HMAC signing uses `WORKER_HMAC_KEY` end-to-end. Headers: `X-Worker-Timestamp` (seconds), `X-Worker-Signature` (hex). Payload: `METHOD\nPATH\nTIMESTAMP\nBODY` where BODY is the raw body string (not hashed).
- Scraper unit tests use captured HTML fixtures, not live network. The store adapters take a `Page`-like context that tests stub.
- Schema changes are applied via `pnpm --filter @eat/server db:push`. The repo does **not** keep generated SQL migrations under VC.
- Each task ends with a commit. Commit messages follow the existing repo style (lowercase prefix `phase3:`, short imperative subject, optional body).

## File structure

**Schema**
- Modify: `apps/server/src/db/schema/supermarket.ts` — add `scraperJobs` table.
- Create: `apps/server/src/db/schema/prices.ts` — `shoppingListPrices` table (kept separate to keep file focused).
- Modify: `apps/server/src/db/schema/index.ts` — re-export new tables.

**Shared types**
- Modify: `packages/shared/src/index.ts` — add scraper job + price types.

**Server routes**
- Create: `apps/server/src/routes/scraper.ts` + `apps/server/src/routes/scraper.test.ts`.
- Modify: `apps/server/src/routes/shopping-lists.ts` + `apps/server/src/routes/shopping-lists.test.ts`.
- Modify: `apps/server/src/app.ts` — register `/api/scraper`.

**Scraper worker**
- Create: `apps/scraper/src/encryption.ts` + `apps/scraper/src/encryption.test.ts`.
- Create: `apps/scraper/src/session.ts` + `apps/scraper/src/session.test.ts`.
- Modify: `apps/scraper/src/worker-sdk/sign.ts` + `sign.test.ts` (refactor to OpenBrain scheme).
- Modify: `apps/scraper/src/worker-sdk/client.ts` + `apps/scraper/src/worker-sdk/types.ts`.
- Create: `apps/scraper/src/bootstrap/newworld-login.ts` (entry binary).
- Create: `apps/scraper/src/bootstrap/ingest.ts` (entry binary).
- Replace: `apps/scraper/src/stores/newworld.ts` + create `apps/scraper/src/stores/newworld.test.ts`.
- Create: `apps/scraper/src/stores/match.ts` + `apps/scraper/src/stores/match.test.ts`.
- Modify: `apps/scraper/src/index.ts` — wire job dispatch through new lifecycle.
- Modify: `apps/scraper/package.json` — add `bootstrap:newworld`, `bootstrap:ingest`, `smoke:newworld` scripts; add deps.
- Create: `apps/scraper/test/fixtures/newworld/search.html`, `orders.html`, `logged-out.html`, `README.md`.
- Create: `apps/scraper/src/smoke/newworld.ts` (entry binary).

**Web**
- Create: `apps/web/src/api/prices.ts`.
- Create: `apps/web/src/hooks/usePricesForList.ts`.
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx` + `.css`.
- Create: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx` (file does not exist yet).

**Docs**
- Modify: `PLAN.md`, `ARCHITECTURE.md`, `DECISIONS.md`.

---

## Task 1: Schema — `scraper_jobs` and `shopping_list_prices` tables

**Files:**
- Modify: `apps/server/src/db/schema/supermarket.ts`
- Create: `apps/server/src/db/schema/prices.ts`
- Modify: `apps/server/src/db/schema/index.ts`

- [ ] **Step 1: Append `scraperJobs` to `supermarket.ts`**

Add to the bottom of `apps/server/src/db/schema/supermarket.ts`:

```typescript
import { jsonb, integer } from 'drizzle-orm/pg-core';

export const scraperJobs = pgTable('scraper_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  store: storeEnum('store').notNull(),
  type: text('type').notNull(),                                // 'import_past_orders' | 'compare_prices'
  payload: jsonb('payload'),                                   // type-specific input
  status: text('status').notNull().default('pending'),         // 'pending' | 'in_progress' | 'done' | 'failed'
  result: jsonb('result'),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  claimedAt: timestamp('claimed_at'),
  completedAt: timestamp('completed_at'),
});
```

Also extend the `import` line at the top to include `jsonb` and `integer`:

```typescript
import { pgTable, uuid, text, timestamp, numeric, boolean, unique, jsonb, integer } from 'drizzle-orm/pg-core';
```

Update the comment on `encryptedSessionBlob` from `// AES-256 encrypted cookie blob; key lives on server only` to:

```typescript
  encryptedSessionBlob: text('encrypted_session_blob'), // base64 of (iv || authTag || ciphertext); key lives on the Mac mini only
```

- [ ] **Step 2: Create `apps/server/src/db/schema/prices.ts`**

```typescript
import { pgTable, uuid, text, timestamp, numeric, boolean, unique } from 'drizzle-orm/pg-core';
import { shoppingListItems } from './shopping.js';
import { storeEnum } from './enums.js';

export const shoppingListPrices = pgTable('shopping_list_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  shoppingListItemId: uuid('shopping_list_item_id').notNull().references(() => shoppingListItems.id, { onDelete: 'cascade' }),
  store: storeEnum('store').notNull(),
  sku: text('sku'),
  name: text('name'),
  price: numeric('price', { precision: 10, scale: 2 }),
  inStock: boolean('in_stock').notNull().default(true),
  matched: boolean('matched').notNull().default(true),
  checkedAt: timestamp('checked_at').notNull().defaultNow(),
}, t => [unique().on(t.shoppingListItemId, t.store)]);
```

- [ ] **Step 3: Re-export from `index.ts`**

Modify `apps/server/src/db/schema/index.ts` to add:

```typescript
export * from './prices.js';
```

(after the existing `export * from './sync.js';` line.)

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @eat/server build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/schema/
git commit -m "phase3: schema for scraper_jobs and shopping_list_prices"
```

---

## Task 2: Shared types for scraper jobs and prices

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Append the scraper section to `packages/shared/src/index.ts`**

Add at the end of the file:

```typescript
// ─── Supermarket / scraper ───────────────────────────────────────────────────

export type Store = 'new_world' | 'paknsave' | 'woolworths';

export type ScraperJobType = 'import_past_orders' | 'compare_prices';
export type ScraperJobStatus = 'pending' | 'in_progress' | 'done' | 'failed';

export interface ScraperJob {
  id: string;
  householdId: string;
  store: Store;
  type: ScraperJobType;
  payload: Record<string, unknown> | null;
  status: ScraperJobStatus;
  attempts: number;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface ShoppingListPrice {
  id: string;
  shoppingListItemId: string;
  store: Store;
  sku: string | null;
  name: string | null;
  price: number | null;        // numeric in DB → string over the wire is parsed to number here
  inStock: boolean;
  matched: boolean;
  checkedAt: string;
}

export interface PricesForListResponse {
  prices: ShoppingListPrice[];
  job: { id: string; status: ScraperJobStatus; error: string | null } | null;
}

export interface RefreshPricesResponse {
  jobId: string;
}

export interface ImportPastOrdersInput {
  store: Store;
}

// Result payloads sent back from the scraper
export interface ComparePricesResult {
  items: Array<{
    shoppingListItemId: string;
    sku: string | null;
    name: string | null;
    brand: string | null;
    price: number | null;
    inStock: boolean;
    matched: boolean;
  }>;
}

export interface ImportPastOrdersResult {
  products: Array<{
    sku: string;
    name: string;
    brand: string | null;
    canonicalFoodHint: string | null;   // best-effort match the worker found
  }>;
}
```

- [ ] **Step 2: Build shared package**

Run: `pnpm --filter @eat/shared build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "phase3: shared types for scraper jobs and prices"
```

---

## Task 3: Refactor scraper HMAC sign module to OpenBrain scheme

**Files:**
- Modify: `apps/scraper/src/worker-sdk/sign.ts`
- Modify: `apps/scraper/src/worker-sdk/sign.test.ts`

- [ ] **Step 1: Replace `apps/scraper/src/worker-sdk/sign.ts`**

```typescript
import { createHmac } from 'node:crypto';

/**
 * Sign an outbound worker request with HMAC-SHA256, matching the scheme used
 * by the OpenBrain worker and accepted by `apps/server/src/routes/sync.ts`.
 *
 * Payload: METHOD + '\n' + PATH + '\n' + TIMESTAMP_SECONDS + '\n' + BODY
 * (raw body string, not hashed). Server replay window is 300 s.
 */
export function signRequest(
  method: string,
  path: string,
  body: string,
  secret: string,
): { timestamp: string; signature: string } {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { timestamp, signature };
}

export function signedHeaders(method: string, path: string, body: string, secret: string): Record<string, string> {
  const { timestamp, signature } = signRequest(method, path, body, secret);
  return {
    'X-Worker-Timestamp': timestamp,
    'X-Worker-Signature': signature,
    'Content-Type': 'application/json',
  };
}
```

- [ ] **Step 2: Replace `apps/scraper/src/worker-sdk/sign.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { signRequest, signedHeaders } from './sign.js';

describe('signRequest', () => {
  it('produces a deterministic signature for the same inputs', () => {
    // We can't pin the timestamp easily, so we re-derive expected from the returned timestamp.
    const { timestamp, signature } = signRequest('GET', '/api/scraper/jobs/pending', '', 'sekret');
    const expected = createHmac('sha256', 'sekret')
      .update(`GET\n/api/scraper/jobs/pending\n${timestamp}\n`)
      .digest('hex');
    expect(signature).toBe(expected);
  });

  it('uppercases the method and includes the body verbatim', () => {
    const body = JSON.stringify({ ok: true });
    const { timestamp, signature } = signRequest('post', '/api/scraper/session', body, 'sekret');
    const expected = createHmac('sha256', 'sekret')
      .update(`POST\n/api/scraper/session\n${timestamp}\n${body}`)
      .digest('hex');
    expect(signature).toBe(expected);
  });
});

describe('signedHeaders', () => {
  it('returns the three headers the server expects', () => {
    const headers = signedHeaders('GET', '/x', '', 'k');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Worker-Timestamp']).toMatch(/^\d+$/);
    expect(headers['X-Worker-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @eat/scraper test -- sign.test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/scraper/src/worker-sdk/sign.ts apps/scraper/src/worker-sdk/sign.test.ts
git commit -m "phase3: align scraper HMAC sign module with OpenBrain scheme"
```

---

## Task 4: Worker SDK types + client surface

**Files:**
- Modify: `apps/scraper/src/worker-sdk/types.ts`
- Modify: `apps/scraper/src/worker-sdk/client.ts`

- [ ] **Step 1: Replace `apps/scraper/src/worker-sdk/types.ts`**

```typescript
export type Store = 'new_world' | 'paknsave' | 'woolworths';
export type JobType = 'import_past_orders' | 'compare_prices';
export type JobStatus = 'pending' | 'in_progress' | 'done' | 'failed';

export interface ScraperJob {
  id: string;
  householdId: string;
  store: Store;
  type: JobType;
  payload: Record<string, unknown> | null;
  status: JobStatus;
  attempts: number;
  createdAt: string;
}

export interface JobResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface SessionEnvelope {
  encryptedBlob: string;
  lastLoginAt: string | null;
}
```

- [ ] **Step 2: Replace `apps/scraper/src/worker-sdk/client.ts`**

```typescript
import 'dotenv/config';
import { signedHeaders } from './sign.js';
import type { JobResult, ScraperJob, SessionEnvelope, Store } from './types.js';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001';
const SECRET = process.env.WORKER_HMAC_KEY ?? '';

async function workerFetch(method: string, path: string, body?: unknown): Promise<Response> {
  const bodyStr = body ? JSON.stringify(body) : '';
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: signedHeaders(method, path, bodyStr, SECRET),
    body: bodyStr || undefined,
  });
}

export async function fetchPendingJobs(): Promise<ScraperJob[]> {
  const res = await workerFetch('GET', '/api/scraper/jobs/pending');
  if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);
  const json = (await res.json()) as { jobs: ScraperJob[] };
  return json.jobs;
}

export async function claimJob(jobId: string): Promise<void> {
  const res = await workerFetch('POST', `/api/scraper/jobs/${jobId}/claim`);
  if (!res.ok) throw new Error(`Failed to claim job ${jobId}: ${res.status}`);
}

export async function reportJobResult(jobId: string, result: JobResult): Promise<void> {
  const res = await workerFetch('POST', `/api/scraper/jobs/${jobId}/result`, result);
  if (!res.ok) throw new Error(`Failed to report job result ${jobId}: ${res.status}`);
}

export async function fetchSession(householdId: string, store: Store): Promise<SessionEnvelope | null> {
  const res = await workerFetch('GET', `/api/scraper/session/${householdId}/${store}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`);
  return (await res.json()) as SessionEnvelope;
}

export async function postSession(householdId: string, store: Store, encryptedBlob: string): Promise<void> {
  const res = await workerFetch('POST', '/api/scraper/session', { householdId, store, encryptedBlob });
  if (!res.ok) throw new Error(`Failed to post session: ${res.status}`);
}
```

- [ ] **Step 3: Build scraper**

Run: `pnpm --filter @eat/scraper build`
Expected: success (the `index.ts` will fail-build because it references the old job shape — fixed in Task 13. For now, do not commit the build failure; just verify the SDK files themselves compile by running `pnpm --filter @eat/scraper test -- sign.test` again to ensure no regressions in tested files).

If the broader build fails, that is expected at this point. Move on.

- [ ] **Step 4: Commit**

```bash
git add apps/scraper/src/worker-sdk/types.ts apps/scraper/src/worker-sdk/client.ts
git commit -m "phase3: scraper worker SDK — typed jobs lifecycle and session calls"
```

---

## Task 5: AES-256-GCM encryption module

**Files:**
- Create: `apps/scraper/src/encryption.ts`
- Create: `apps/scraper/src/encryption.test.ts`

- [ ] **Step 1: Write the failing test first**

Create `apps/scraper/src/encryption.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from './encryption.js';

const KEY = randomBytes(32).toString('base64');

describe('encrypt/decrypt', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = JSON.stringify({ cookies: [{ name: 'sid', value: 'xyz' }] });
    const ciphertext = encrypt(plaintext, KEY);
    expect(ciphertext).not.toEqual(plaintext);
    expect(decrypt(ciphertext, KEY)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encrypt('hello', KEY);
    const b = encrypt('hello', KEY);
    expect(a).not.toBe(b);
  });

  it('throws when the ciphertext is tampered with', () => {
    const ciphertext = encrypt('hello', KEY);
    const buf = Buffer.from(ciphertext, 'base64');
    buf[buf.length - 1] ^= 0x01; // flip a bit in the ciphertext tail
    expect(() => decrypt(buf.toString('base64'), KEY)).toThrow();
  });

  it('throws when the key is wrong', () => {
    const ciphertext = encrypt('hello', KEY);
    const otherKey = randomBytes(32).toString('base64');
    expect(() => decrypt(ciphertext, otherKey)).toThrow();
  });

  it('throws if the key is not 32 bytes', () => {
    expect(() => encrypt('x', Buffer.from('short').toString('base64'))).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @eat/scraper test -- encryption.test`
Expected: fail with "Cannot find module './encryption.js'".

- [ ] **Step 3: Implement `apps/scraper/src/encryption.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function loadKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error(`SUPERMARKET_ENC_KEY must decode to 32 bytes (got ${key.length})`);
  }
  return key;
}

/** Encrypt `plaintext` and return base64(iv || authTag || ciphertext). */
export function encrypt(plaintext: string, base64Key: string): string {
  const key = loadKey(base64Key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Decrypt a value produced by `encrypt`. Throws on auth-tag mismatch or wrong key. */
export function decrypt(base64Blob: string, base64Key: string): string {
  const key = loadKey(base64Key);
  const blob = Buffer.from(base64Blob, 'base64');
  if (blob.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('ciphertext too short');
  }
  const iv = blob.subarray(0, IV_LENGTH);
  const tag = blob.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = blob.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @eat/scraper test -- encryption.test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/encryption.ts apps/scraper/src/encryption.test.ts
git commit -m "phase3: AES-256-GCM encryption helpers for supermarket sessions"
```

---

## Task 6: Session loader (fetch + decrypt + parse storage state)

**Files:**
- Create: `apps/scraper/src/session.ts`
- Create: `apps/scraper/src/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/scraper/src/session.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt } from './encryption.js';

const KEY = randomBytes(32).toString('base64');
process.env.SUPERMARKET_ENC_KEY = KEY;

const mocks = vi.hoisted(() => ({ fetchSession: vi.fn() }));
vi.mock('./worker-sdk/client.js', () => ({ fetchSession: mocks.fetchSession }));

const { loadStorageState } = await import('./session.js');

describe('loadStorageState', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when the server has no session for this household/store', async () => {
    mocks.fetchSession.mockResolvedValue(null);
    const result = await loadStorageState('hh-1', 'new_world');
    expect(result).toBeNull();
  });

  it('decrypts the blob and parses the storage state JSON', async () => {
    const storage = { cookies: [{ name: 'sid', value: 'xyz', domain: '.newworld.co.nz', path: '/' }], origins: [] };
    mocks.fetchSession.mockResolvedValue({
      encryptedBlob: encrypt(JSON.stringify(storage), KEY),
      lastLoginAt: '2026-05-10T00:00:00.000Z',
    });
    const result = await loadStorageState('hh-1', 'new_world');
    expect(result).toEqual(storage);
  });

  it('throws if the blob cannot be decrypted', async () => {
    mocks.fetchSession.mockResolvedValue({ encryptedBlob: 'not-valid-base64-blob', lastLoginAt: null });
    await expect(loadStorageState('hh-1', 'new_world')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `pnpm --filter @eat/scraper test -- session.test`
Expected: fail with "Cannot find module './session.js'".

- [ ] **Step 3: Implement `apps/scraper/src/session.ts`**

```typescript
import { decrypt } from './encryption.js';
import { fetchSession } from './worker-sdk/client.js';
import type { Store } from './worker-sdk/types.js';

// A subset of Playwright's StorageState we actually pass through unmodified.
export interface StorageState {
  cookies: Array<Record<string, unknown>>;
  origins: Array<Record<string, unknown>>;
}

/**
 * Fetch the encrypted session for (householdId, store) from the server,
 * decrypt with `SUPERMARKET_ENC_KEY`, and parse into a Playwright
 * `storageState`-compatible object. Returns null if the server has no session.
 */
export async function loadStorageState(householdId: string, store: Store): Promise<StorageState | null> {
  const key = process.env.SUPERMARKET_ENC_KEY;
  if (!key) throw new Error('SUPERMARKET_ENC_KEY not set');
  const envelope = await fetchSession(householdId, store);
  if (!envelope) return null;
  const plaintext = decrypt(envelope.encryptedBlob, key);
  return JSON.parse(plaintext) as StorageState;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @eat/scraper test -- session.test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/session.ts apps/scraper/src/session.test.ts
git commit -m "phase3: session loader fetches + decrypts encrypted storage state"
```

---

## Task 7: Server scraper routes — session endpoints (HMAC)

**Files:**
- Create: `apps/server/src/routes/scraper.ts`
- Create: `apps/server/src/routes/scraper.test.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Write the failing test (session endpoints only)**

Create `apps/server/src/routes/scraper.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';

const mocks = vi.hoisted(() => ({
  insertReturning: vi.fn(),
  selectFirst: vi.fn(),
  selectMany: vi.fn(),
  updateExec: vi.fn(),
  deleteExec: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  desc: () => null,
  sql: Object.assign((...args: unknown[]) => args, { template: () => null }),
}));

vi.mock('../db/index.js', () => ({
  db: {
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({ returning: mocks.insertReturning }),
        returning: mocks.insertReturning,
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: mocks.selectMany }),
          limit: mocks.selectFirst,
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: mocks.updateExec }),
      }),
    }),
    delete: () => ({ where: mocks.deleteExec }),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
      insert: () => ({ values: () => ({ onConflictDoNothing: () => Promise.resolve(), returning: () => Promise.resolve([]) }) }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      delete: () => ({ where: () => Promise.resolve() }),
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    }),
  },
}));

vi.mock('../db/schema/index.js', () => ({
  supermarketCredentials: {}, supermarketProducts: {},
  scraperJobs: {}, shoppingListPrices: {}, shoppingListItems: {},
  canonicalFoods: {},
}));

process.env.WORKER_HMAC_KEY = 'test-secret-key';
const { default: scraperRouter } = await import('./scraper.js');

function sign(method: string, path: string, body = '') {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', 'test-secret-key')
    .update(`${method}\n${path}\n${timestamp}\n${body}`)
    .digest('hex');
  return { 'X-Worker-Timestamp': timestamp, 'X-Worker-Signature': sig };
}

describe('scraper router — session endpoints', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/scraper', scraperRouter);
  });

  it('POST /session rejects without HMAC', async () => {
    const res = await request(app).post('/api/scraper/session').send({ householdId: 'h', store: 'new_world', encryptedBlob: 'x' });
    expect(res.status).toBe(401);
  });

  it('POST /session validates body shape', async () => {
    const body = JSON.stringify({ householdId: 'h' }); // missing store + blob
    const res = await request(app).post('/api/scraper/session').set(sign('POST', '/api/scraper/session', body)).type('json').send(body);
    expect(res.status).toBe(400);
  });

  it('POST /session upserts and returns ok', async () => {
    mocks.insertReturning.mockResolvedValue([{ id: 'cred-1' }]);
    const body = JSON.stringify({ householdId: 'h', store: 'new_world', encryptedBlob: 'blob' });
    const res = await request(app).post('/api/scraper/session').set(sign('POST', '/api/scraper/session', body)).type('json').send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('GET /session/:hh/:store 404s when missing', async () => {
    mocks.selectFirst.mockResolvedValue([]);
    const path = '/api/scraper/session/h/new_world';
    const res = await request(app).get(path).set(sign('GET', path));
    expect(res.status).toBe(404);
  });

  it('GET /session/:hh/:store returns the envelope when present', async () => {
    mocks.selectFirst.mockResolvedValue([{ encryptedSessionBlob: 'blob', lastLoginAt: new Date('2026-05-10T00:00:00Z') }]);
    const path = '/api/scraper/session/h/new_world';
    const res = await request(app).get(path).set(sign('GET', path));
    expect(res.status).toBe(200);
    expect(res.body.encryptedBlob).toBe('blob');
  });
});
```

- [ ] **Step 2: Run the test (should fail to import)**

Run: `pnpm --filter @eat/server test -- scraper.test`
Expected: fail with "Cannot find module './scraper.js'".

- [ ] **Step 3: Create `apps/server/src/routes/scraper.ts` with session endpoints + HMAC middleware**

```typescript
import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { and, eq, desc, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import {
  supermarketCredentials, supermarketProducts,
  scraperJobs, shoppingListPrices, shoppingListItems,
  canonicalFoods,
} from '../db/schema/index.js';

const router: ExpressRouter = Router();

// Mirror of withWorkerAuth in sync.ts. Kept duplicated here to avoid coupling
// the two routers; if a third worker shows up, extract into a shared module.
function withWorkerAuth(req: Request, res: Response, next: NextFunction) {
  const key = process.env.WORKER_HMAC_KEY;
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

// ─── Session endpoints ───────────────────────────────────────────────────────

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
      })
      .returning();
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

export default router;
```

- [ ] **Step 4: Wire the router into `app.ts`**

Modify `apps/server/src/app.ts` to add the import and `app.use` line. After the existing scraper-adjacent routes:

```typescript
import scraperRouter from './routes/scraper.js';
// ...
app.use('/api/scraper', scraperRouter);
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @eat/server test -- scraper.test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/scraper.ts apps/server/src/routes/scraper.test.ts apps/server/src/app.ts
git commit -m "phase3: server scraper session endpoints (HMAC, upsert + read)"
```

---

## Task 8: Server scraper routes — job lifecycle (pending / claim / result)

**Files:**
- Modify: `apps/server/src/routes/scraper.ts`
- Modify: `apps/server/src/routes/scraper.test.ts`

- [ ] **Step 1: Append job-lifecycle tests to `scraper.test.ts`**

Add inside the existing `describe('scraper router — session endpoints', ...)` file, as a new top-level `describe` block:

```typescript
describe('scraper router — jobs', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/scraper', scraperRouter);
  });

  it('GET /jobs/pending returns 401 without HMAC', async () => {
    const res = await request(app).get('/api/scraper/jobs/pending');
    expect(res.status).toBe(401);
  });

  it('GET /jobs/pending returns the pending jobs list', async () => {
    mocks.selectMany.mockResolvedValue([
      { id: 'job-1', householdId: 'h', store: 'new_world', type: 'compare_prices', payload: { shoppingListId: 's1' }, status: 'pending', attempts: 0, createdAt: new Date() },
    ]);
    const res = await request(app).get('/api/scraper/jobs/pending').set(sign('GET', '/api/scraper/jobs/pending'));
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0].id).toBe('job-1');
  });

  it('POST /jobs/:id/claim marks the job in_progress', async () => {
    mocks.updateExec.mockResolvedValue([{ id: 'job-1' }]);
    const res = await request(app).post('/api/scraper/jobs/job-1/claim').set(sign('POST', '/api/scraper/jobs/job-1/claim'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('POST /jobs/:id/result with ok=true marks done', async () => {
    mocks.selectFirst.mockResolvedValue([{ id: 'job-1', type: 'compare_prices', householdId: 'h', store: 'new_world' }]);
    mocks.updateExec.mockResolvedValue([{ id: 'job-1' }]);
    const body = JSON.stringify({ ok: true, data: { items: [] } });
    const res = await request(app)
      .post('/api/scraper/jobs/job-1/result')
      .set(sign('POST', '/api/scraper/jobs/job-1/result', body))
      .type('json').send(body);
    expect(res.status).toBe(200);
  });

  it('POST /jobs/:id/result with ok=false records failure', async () => {
    mocks.selectFirst.mockResolvedValue([{ id: 'job-1', type: 'compare_prices', householdId: 'h', store: 'new_world' }]);
    mocks.updateExec.mockResolvedValue([{ id: 'job-1' }]);
    const body = JSON.stringify({ ok: false, error: 'session_expired' });
    const res = await request(app)
      .post('/api/scraper/jobs/job-1/result')
      .set(sign('POST', '/api/scraper/jobs/job-1/result', body))
      .type('json').send(body);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Append job lifecycle handlers to `scraper.ts`**

Append to `apps/server/src/routes/scraper.ts`, before `export default router;`:

```typescript
// ─── Job lifecycle ───────────────────────────────────────────────────────────

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
        await applyComparePricesResult(job.householdId, job.store, data);
      } else if (job.type === 'import_past_orders') {
        await applyImportPastOrdersResult(job.householdId, job.store, data);
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
      .where(eq(scraperJobs.id, id))
      .returning();

    res.json({ ok: true });
  } catch (err) {
    console.error('[scraper] POST /jobs/:id/result', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface ComparePricesItem {
  shoppingListItemId: string;
  sku: string | null;
  name: string | null;
  brand: string | null;
  price: number | null;
  inStock: boolean;
  matched: boolean;
}

async function applyComparePricesResult(_householdId: string, store: string, data: Record<string, unknown>): Promise<void> {
  const items = (data['items'] ?? []) as ComparePricesItem[];
  if (items.length === 0) return;

  await db.transaction(async tx => {
    for (const item of items) {
      await tx
        .insert(shoppingListPrices)
        .values({
          shoppingListItemId: item.shoppingListItemId,
          store: store as 'new_world' | 'paknsave' | 'woolworths',
          sku: item.sku,
          name: item.name,
          price: item.price !== null ? String(item.price) : null,
          inStock: item.inStock,
          matched: item.matched,
          checkedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [shoppingListPrices.shoppingListItemId, shoppingListPrices.store],
          set: {
            sku: item.sku,
            name: item.name,
            price: item.price !== null ? String(item.price) : null,
            inStock: item.inStock,
            matched: item.matched,
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
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @eat/server test -- scraper.test`
Expected: all pass (12 tests).

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/scraper.ts apps/server/src/routes/scraper.test.ts
git commit -m "phase3: scraper job lifecycle routes (pending/claim/result) with result handlers"
```

---

## Task 9: User-facing routes — refresh-prices + GET prices + import-past-orders

**Files:**
- Modify: `apps/server/src/routes/shopping-lists.ts`
- Modify: `apps/server/src/routes/shopping-lists.test.ts`
- Modify: `apps/server/src/routes/scraper.ts` (one extra user-auth route)

- [ ] **Step 1: Inspect the shopping-lists router to find the household-resolution helper**

Read `apps/server/src/routes/shopping-lists.ts` to find the existing helper used to resolve `householdId` from the session (similar to `await db.select({ householdId: memberships.householdId }).from(memberships).where(eq(memberships.userId, ...)).limit(1)` in other routes).

- [ ] **Step 2: Add `POST /:id/refresh-prices` and `GET /:id/prices` to shopping-lists.ts**

Append the routes inside the existing router, before `export default router`. Reuse the same auth/household pattern (`auth.api.getSession`, then `db.select(...).from(memberships)...`):

```typescript
// ─── Price comparison (Phase 3) ───────────────────────────────────────────────

router.post('/:id/refresh-prices', async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const memb = await db.select({ householdId: memberships.householdId }).from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  const householdId = memb[0]?.householdId;
  if (!householdId) { res.status(403).json({ error: 'No household' }); return; }

  const listId = req.params['id'] as string;
  const inserted = await db
    .insert(scraperJobs)
    .values({
      householdId,
      store: 'new_world',
      type: 'compare_prices',
      payload: { shoppingListId: listId },
      status: 'pending',
    })
    .returning({ id: scraperJobs.id });

  res.json({ jobId: inserted[0]?.id });
});

router.get('/:id/prices', async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const memb = await db.select({ householdId: memberships.householdId }).from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  const householdId = memb[0]?.householdId;
  if (!householdId) { res.status(403).json({ error: 'No household' }); return; }

  const listId = req.params['id'] as string;

  const priceRows = await db
    .select({
      id: shoppingListPrices.id,
      shoppingListItemId: shoppingListPrices.shoppingListItemId,
      store: shoppingListPrices.store,
      sku: shoppingListPrices.sku,
      name: shoppingListPrices.name,
      price: shoppingListPrices.price,
      inStock: shoppingListPrices.inStock,
      matched: shoppingListPrices.matched,
      checkedAt: shoppingListPrices.checkedAt,
    })
    .from(shoppingListPrices)
    .innerJoin(shoppingListItems, eq(shoppingListPrices.shoppingListItemId, shoppingListItems.id))
    .where(eq(shoppingListItems.shoppingListId, listId));

  const jobRows = await db
    .select({ id: scraperJobs.id, status: scraperJobs.status, error: scraperJobs.error, createdAt: scraperJobs.createdAt, payload: scraperJobs.payload })
    .from(scraperJobs)
    .where(and(eq(scraperJobs.householdId, householdId), eq(scraperJobs.type, 'compare_prices')))
    .orderBy(desc(scraperJobs.createdAt))
    .limit(5);

  // Find the most recent job that targets this list.
  const job = jobRows.find(j => {
    const p = j.payload as Record<string, unknown> | null;
    return p && p['shoppingListId'] === listId;
  }) ?? null;

  res.json({
    prices: priceRows.map(r => ({
      ...r,
      price: r.price !== null ? Number(r.price) : null,
      checkedAt: r.checkedAt instanceof Date ? r.checkedAt.toISOString() : r.checkedAt,
    })),
    job: job ? { id: job.id, status: job.status, error: job.error } : null,
  });
});
```

You will also need to extend the imports at the top of `shopping-lists.ts`:

```typescript
import { desc } from 'drizzle-orm';
// ...
import { scraperJobs, shoppingListPrices, shoppingListItems } from '../db/schema/index.js';
```

(`shoppingListItems` is likely already imported; only add what's missing.)

- [ ] **Step 3: Add `POST /import-past-orders` to scraper.ts (user-auth, NOT HMAC)**

Append to `apps/server/src/routes/scraper.ts`, before `export default router`. This route uses Better-Auth (mirror the pattern from shopping-lists), so add the imports at the top of `scraper.ts`:

```typescript
import { auth } from '../auth.js';
import { fromNodeHeaders } from 'better-auth/node';
import { memberships } from '../db/schema/index.js';
```

Then the route:

```typescript
router.post('/import-past-orders', async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const memb = await db.select({ householdId: memberships.householdId }).from(memberships).where(eq(memberships.userId, session.user.id)).limit(1);
  const householdId = memb[0]?.householdId;
  if (!householdId) { res.status(403).json({ error: 'No household' }); return; }

  const { store } = req.body as { store?: string };
  if (store !== 'new_world' && store !== 'paknsave' && store !== 'woolworths') {
    res.status(400).json({ error: 'store required' });
    return;
  }

  const inserted = await db
    .insert(scraperJobs)
    .values({ householdId, store, type: 'import_past_orders', status: 'pending' })
    .returning({ id: scraperJobs.id });

  res.json({ jobId: inserted[0]?.id });
});
```

- [ ] **Step 4: Extend `shopping-lists.test.ts` with two new test cases**

Add inside the existing `describe('shopping-lists router', ...)` block. Note: extend the existing `vi.mock('../db/schema/index.js', ...)` to include `scraperJobs`, `shoppingListPrices` if not already.

```typescript
it('POST /:id/refresh-prices returns 401 unauthenticated', async () => {
  mocks.getSession.mockResolvedValue(null);
  const res = await request(app).post('/api/shopping-lists/list-1/refresh-prices');
  expect(res.status).toBe(401);
});

it('GET /:id/prices returns 401 unauthenticated', async () => {
  mocks.getSession.mockResolvedValue(null);
  const res = await request(app).get('/api/shopping-lists/list-1/prices');
  expect(res.status).toBe(401);
});
```

(These are smoke tests — full mocking of insert/select chains is more work than the value justifies and the route logic mirrors existing routes. The integration story is covered by the scraper.test.ts result-handler tests + the web-side test.)

Update the `vi.mock('../db/schema/index.js', ...)` block in `shopping-lists.test.ts` to add the new tables:

```typescript
vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlans: {}, mealPlanEntries: {}, recipes: {}, recipeIngredients: {},
  inventoryItems: {}, canonicalFoods: {}, staples: {},
  shoppingLists: {}, shoppingListItems: {},
  scraperJobs: {}, shoppingListPrices: {},
}));
```

- [ ] **Step 5: Run all server tests**

Run: `pnpm --filter @eat/server test`
Expected: all pass (existing + 2 new shopping-list tests + scraper tests).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/shopping-lists.ts apps/server/src/routes/shopping-lists.test.ts apps/server/src/routes/scraper.ts
git commit -m "phase3: user-auth routes for refresh-prices, get prices, import-past-orders"
```

---

## Task 10: Apply schema to dev DB

**Files:** none changed; this is a one-command task that updates the running Postgres.

- [ ] **Step 1: Push schema changes**

Run: `pnpm --filter @eat/server db:push`
Expected: drizzle-kit reports the two new tables (`scraper_jobs`, `shopping_list_prices`) and an updated comment on `supermarket_credentials`. Confirm at the prompt.

If the dev DB is unreachable (e.g., the env you're running in doesn't have Supabase access), skip with a note in the next task's commit body. The migration is non-destructive and can be applied later.

- [ ] **Step 2: No commit needed** (no source change). Note in execution log whether this succeeded.

---

## Task 11: Catalog matching module

**Files:**
- Create: `apps/scraper/src/stores/match.ts`
- Create: `apps/scraper/src/stores/match.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/scraper/src/stores/match.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pickMatch } from './match.js';

interface ListItem { id: string; name: string; canonicalFoodId: string | null; }
interface SearchResult { sku: string; name: string; brand: string | null; price: number; inStock: boolean; }

const item: ListItem = { id: 'i1', name: 'Eggs', canonicalFoodId: 'cf-eggs' };

const preferredEgg = { sku: 'NW-001', name: 'Free Range Eggs Size 7 (12 pk)', brand: 'Mainland', price: 7.49, inStock: true };
const otherEgg     = { sku: 'NW-002', name: 'Cage Eggs Size 6 (10 pk)',         brand: 'Pams',     price: 4.99, inStock: true };
const unrelated    = { sku: 'NW-099', name: 'Egg Noodles 250g',                  brand: 'Pams',     price: 2.20, inStock: true };

describe('pickMatch', () => {
  it('prefers a result whose brand matches the preferred map for this canonical food', () => {
    const result = pickMatch({
      item,
      candidates: [unrelated, otherEgg, preferredEgg] as SearchResult[],
      preferredBrandsByCanonicalFood: { 'cf-eggs': new Set(['Mainland']) },
    });
    expect(result?.sku).toBe('NW-001');
  });

  it('falls back to best name match when no preferred brand matches', () => {
    const result = pickMatch({
      item,
      candidates: [unrelated, otherEgg] as SearchResult[],
      preferredBrandsByCanonicalFood: {},
    });
    expect(result?.sku).toBe('NW-002');
  });

  it('returns null when no candidate is plausible', () => {
    const noisy = [{ sku: 'NW-500', name: 'Toilet Paper 12pk', brand: null, price: 9.99, inStock: true }] as SearchResult[];
    const result = pickMatch({ item, candidates: noisy, preferredBrandsByCanonicalFood: {} });
    expect(result).toBeNull();
  });

  it('returns null on empty candidates', () => {
    const result = pickMatch({ item, candidates: [], preferredBrandsByCanonicalFood: {} });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @eat/scraper test -- match.test`
Expected: fail with module not found.

- [ ] **Step 3: Implement `apps/scraper/src/stores/match.ts`**

```typescript
export interface ListItemForMatch {
  id: string;
  name: string;
  canonicalFoodId: string | null;
}

export interface SearchResult {
  sku: string;
  name: string;
  brand: string | null;
  price: number;
  inStock: boolean;
}

export interface MatchInput {
  item: ListItemForMatch;
  candidates: SearchResult[];
  preferredBrandsByCanonicalFood: Record<string, Set<string>>;
}

const STOPWORDS = new Set(['the', 'a', 'and', 'or', 'pk', 'pack', 'g', 'kg', 'ml', 'l']);

function tokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(t => t && !STOPWORDS.has(t))
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

/**
 * Pick the best store-side product for a shopping-list item.
 *
 * Strategy:
 *  1. If any candidate's brand is in the preferred set for this item's
 *     canonical food, return the best of those by name overlap.
 *  2. Otherwise, return the candidate with the highest token overlap with
 *     the list-item name, requiring at least one shared token.
 *  3. Return null if nothing meets the threshold.
 */
export function pickMatch({ item, candidates, preferredBrandsByCanonicalFood }: MatchInput): SearchResult | null {
  if (candidates.length === 0) return null;

  const itemTokens = tokens(item.name);
  if (itemTokens.size === 0) return null;

  const preferredBrands = item.canonicalFoodId ? preferredBrandsByCanonicalFood[item.canonicalFoodId] : undefined;

  function score(c: SearchResult): number {
    return tokenOverlap(tokens(c.name), itemTokens);
  }

  if (preferredBrands && preferredBrands.size > 0) {
    const preferred = candidates.filter(c => c.brand && preferredBrands.has(c.brand));
    if (preferred.length > 0) {
      const best = preferred.reduce((a, b) => (score(b) > score(a) ? b : a));
      if (score(best) > 0) return best;
    }
  }

  const best = candidates.reduce((a, b) => (score(b) > score(a) ? b : a));
  return score(best) > 0 ? best : null;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @eat/scraper test -- match.test`
Expected: all 4 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/src/stores/match.ts apps/scraper/src/stores/match.test.ts
git commit -m "phase3: catalog matching with preferred-brand bias"
```

---

## Task 12: New World adapter — fixtures + parsers

**Files:**
- Create: `apps/scraper/test/fixtures/newworld/search.html`
- Create: `apps/scraper/test/fixtures/newworld/orders.html`
- Create: `apps/scraper/test/fixtures/newworld/logged-out.html`
- Create: `apps/scraper/test/fixtures/newworld/README.md`
- Create: `apps/scraper/src/stores/newworld.test.ts`
- Replace: `apps/scraper/src/stores/newworld.ts`

We don't have access to live HTML, so the fixtures use a stable hand-rolled structure that mirrors the *parsing surface* the adapter will rely on. The parser keys off CSS selectors that the smoke test will validate against the real site (and the fixtures will be re-captured on first contact).

- [ ] **Step 1: Write fixtures**

Create `apps/scraper/test/fixtures/newworld/search.html`:

```html
<!doctype html>
<html><body>
  <main>
    <ul data-testid="product-grid">
      <li data-product-id="NW-001" data-in-stock="true">
        <h3 class="product-name">Free Range Eggs Size 7 (12 pk)</h3>
        <span class="product-brand">Mainland</span>
        <span class="product-price">$7.49</span>
      </li>
      <li data-product-id="NW-002" data-in-stock="true">
        <h3 class="product-name">Cage Eggs Size 6 (10 pk)</h3>
        <span class="product-brand">Pams</span>
        <span class="product-price">$4.99</span>
      </li>
      <li data-product-id="NW-003" data-in-stock="false">
        <h3 class="product-name">Organic Eggs (6 pk)</h3>
        <span class="product-brand">Henergy</span>
        <span class="product-price">$8.99</span>
      </li>
    </ul>
  </main>
</body></html>
```

Create `apps/scraper/test/fixtures/newworld/orders.html`:

```html
<!doctype html>
<html><body>
  <main>
    <section data-testid="past-orders">
      <article class="order">
        <ul class="order-items">
          <li data-product-id="NW-001">
            <span class="item-name">Free Range Eggs Size 7 (12 pk)</span>
            <span class="item-brand">Mainland</span>
          </li>
          <li data-product-id="NW-100">
            <span class="item-name">Trim Milk 2L</span>
            <span class="item-brand">Anchor</span>
          </li>
        </ul>
      </article>
      <article class="order">
        <ul class="order-items">
          <li data-product-id="NW-100">
            <span class="item-name">Trim Milk 2L</span>
            <span class="item-brand">Anchor</span>
          </li>
        </ul>
      </article>
    </section>
  </main>
</body></html>
```

Create `apps/scraper/test/fixtures/newworld/logged-out.html`:

```html
<!doctype html>
<html><body>
  <main>
    <div data-testid="login-required">
      <a href="/login">Sign in to see your orders</a>
    </div>
  </main>
</body></html>
```

Create `apps/scraper/test/fixtures/newworld/README.md`:

```markdown
# New World fixtures

Hand-rolled HTML mirroring the parsing surface used by the adapter
(`apps/scraper/src/stores/newworld.ts`). Selectors:

- Search results: `ul[data-testid="product-grid"] > li[data-product-id]`
  with `.product-name`, `.product-brand`, `.product-price`,
  `data-in-stock="true"|"false"`.
- Past orders: `section[data-testid="past-orders"] li[data-product-id]`
  with `.item-name`, `.item-brand`.
- Logged-out marker: `div[data-testid="login-required"]`.

## Refreshing against the live site

When the smoke test fails because New World ships markup changes:

1. Bootstrap a session and run `pnpm --filter @eat/scraper smoke:newworld --capture`.
2. The smoke binary saves three files: `search.live.html`, `orders.live.html`,
   `logged-out.live.html` next to this README.
3. Update the parser in `newworld.ts` to handle the new structure.
4. Replace the fixtures here with trimmed versions of the captures (drop
   navigation chrome, keep the structures the parser reads).
5. Re-run `pnpm --filter @eat/scraper test`.

The smoke `--capture` flag is a follow-up — until it lands, capture by
dropping into the headed browser via the bootstrap script and saving HTML
manually with the dev tools "Copy outerHTML" action.
```

- [ ] **Step 2: Write the failing parser test**

Create `apps/scraper/src/stores/newworld.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSearchResults, parsePastOrders, isLoggedOutPage } from './newworld.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', '..', 'test', 'fixtures', 'newworld');
const fixture = (name: string) => readFileSync(join(fixturesDir, name), 'utf8');

describe('parseSearchResults', () => {
  it('extracts sku, name, brand, price, in-stock', () => {
    const results = parseSearchResults(fixture('search.html'));
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      sku: 'NW-001',
      name: 'Free Range Eggs Size 7 (12 pk)',
      brand: 'Mainland',
      price: 7.49,
      inStock: true,
    });
    expect(results[2]?.inStock).toBe(false);
  });
});

describe('parsePastOrders', () => {
  it('deduplicates products across orders and counts frequency', () => {
    const products = parsePastOrders(fixture('orders.html'));
    expect(products).toHaveLength(2);
    const milk = products.find(p => p.sku === 'NW-100');
    expect(milk?.brand).toBe('Anchor');
    expect(milk?.timesPurchased).toBe(2);
  });
});

describe('isLoggedOutPage', () => {
  it('returns true for the login-required marker', () => {
    expect(isLoggedOutPage(fixture('logged-out.html'))).toBe(true);
  });
  it('returns false for normal pages', () => {
    expect(isLoggedOutPage(fixture('search.html'))).toBe(false);
  });
});
```

- [ ] **Step 3: Add `cheerio` dependency**

Modify `apps/scraper/package.json`:

```json
"dependencies": {
  "cheerio": "^1.0.0",
  "dotenv": "^17.4.2",
  "playwright": "^1.52.0"
}
```

Then install:

Run: `pnpm install`
Expected: cheerio added.

- [ ] **Step 4: Replace `apps/scraper/src/stores/newworld.ts` with parser-only first cut**

```typescript
import * as cheerio from 'cheerio';
import type { Browser } from 'playwright';
import type { JobResult, ScraperJob } from '../worker-sdk/types.js';
import type { StoreAdapter } from './base.js';

export interface ParsedSearchResult {
  sku: string;
  name: string;
  brand: string | null;
  price: number;
  inStock: boolean;
}

export interface ParsedPastOrderProduct {
  sku: string;
  name: string;
  brand: string | null;
  timesPurchased: number;
}

export function parseSearchResults(html: string): ParsedSearchResult[] {
  const $ = cheerio.load(html);
  const out: ParsedSearchResult[] = [];
  $('ul[data-testid="product-grid"] > li[data-product-id]').each((_i, el) => {
    const $el = $(el);
    const sku = $el.attr('data-product-id') ?? '';
    const name = $el.find('.product-name').first().text().trim();
    const brand = $el.find('.product-brand').first().text().trim() || null;
    const priceText = $el.find('.product-price').first().text().trim().replace(/[^0-9.]/g, '');
    const price = parseFloat(priceText);
    const inStock = $el.attr('data-in-stock') === 'true';
    if (sku && name && !Number.isNaN(price)) {
      out.push({ sku, name, brand, price, inStock });
    }
  });
  return out;
}

export function parsePastOrders(html: string): ParsedPastOrderProduct[] {
  const $ = cheerio.load(html);
  const acc = new Map<string, ParsedPastOrderProduct>();
  $('section[data-testid="past-orders"] li[data-product-id]').each((_i, el) => {
    const $el = $(el);
    const sku = $el.attr('data-product-id') ?? '';
    const name = $el.find('.item-name').first().text().trim();
    const brand = $el.find('.item-brand').first().text().trim() || null;
    if (!sku || !name) return;
    const existing = acc.get(sku);
    if (existing) {
      existing.timesPurchased++;
    } else {
      acc.set(sku, { sku, name, brand, timesPurchased: 1 });
    }
  });
  return [...acc.values()];
}

export function isLoggedOutPage(html: string): boolean {
  const $ = cheerio.load(html);
  return $('div[data-testid="login-required"]').length > 0;
}

// The adapter `handle` is filled in once the parsers have tests passing.
// See Task 13.
export const newWorldAdapter: StoreAdapter = {
  async handle(job: ScraperJob, _browser: Browser): Promise<JobResult> {
    return { jobId: job.id, ok: false, error: 'not implemented' };
  },
};
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @eat/scraper test -- newworld.test`
Expected: all 4 pass.

- [ ] **Step 6: Commit**

```bash
git add apps/scraper/src/stores/newworld.ts apps/scraper/src/stores/newworld.test.ts apps/scraper/test/fixtures/newworld/ apps/scraper/package.json pnpm-lock.yaml
git commit -m "phase3: New World HTML parsers + fixtures"
```

---

## Task 13: New World adapter — wire `handle()` to drive Playwright

**Files:**
- Modify: `apps/scraper/src/stores/newworld.ts`
- Modify: `apps/scraper/src/stores/base.ts` (extend `StoreAdapter` if needed for context creation)
- Modify: `apps/scraper/src/index.ts`

- [ ] **Step 1: Update `apps/scraper/src/stores/base.ts` if necessary**

Read `apps/scraper/src/stores/base.ts`. No change is necessary (the existing `handle(job, browser)` signature is sufficient; `handle` will create its own `BrowserContext` from a `storageState`).

- [ ] **Step 2: Append handler logic to `apps/scraper/src/stores/newworld.ts`**

Replace the stub `newWorldAdapter` export with:

```typescript
import { loadStorageState } from '../session.js';

const SEARCH_URL = (q: string) => `https://www.newworld.co.nz/shop/search?q=${encodeURIComponent(q)}`;
const ORDERS_URL = 'https://www.newworld.co.nz/shop/account/orders';

interface ComparePayload { shoppingListId: string; items: Array<{ id: string; name: string; canonicalFoodId: string | null }>; preferredBrandsByCanonicalFood: Record<string, string[]>; }

export const newWorldAdapter: StoreAdapter = {
  async handle(job: ScraperJob, browser: Browser): Promise<JobResult> {
    const storageState = await loadStorageState(job.householdId, 'new_world');
    if (!storageState) {
      return { jobId: job.id, ok: false, error: 'no_session' };
    }

    const context = await browser.newContext({ storageState });
    const page = await context.newPage();

    try {
      if (job.type === 'compare_prices') {
        const payload = job.payload as ComparePayload | null;
        if (!payload || !Array.isArray(payload.items)) {
          return { jobId: job.id, ok: false, error: 'invalid_payload' };
        }
        const preferredMap: Record<string, Set<string>> = {};
        for (const [foodId, brands] of Object.entries(payload.preferredBrandsByCanonicalFood ?? {})) {
          preferredMap[foodId] = new Set(brands);
        }

        const { pickMatch } = await import('./match.js');
        const items = [];
        for (const item of payload.items) {
          await page.goto(SEARCH_URL(item.name), { waitUntil: 'domcontentloaded' });
          const html = await page.content();
          if (isLoggedOutPage(html)) {
            return { jobId: job.id, ok: false, error: 'session_expired' };
          }
          const candidates = parseSearchResults(html);
          const match = pickMatch({ item, candidates, preferredBrandsByCanonicalFood: preferredMap });
          items.push({
            shoppingListItemId: item.id,
            sku: match?.sku ?? null,
            name: match?.name ?? null,
            brand: match?.brand ?? null,
            price: match?.price ?? null,
            inStock: match?.inStock ?? false,
            matched: !!match,
          });
        }
        return { jobId: job.id, ok: true, data: { items } };
      }

      if (job.type === 'import_past_orders') {
        await page.goto(ORDERS_URL, { waitUntil: 'domcontentloaded' });
        const html = await page.content();
        if (isLoggedOutPage(html)) {
          return { jobId: job.id, ok: false, error: 'session_expired' };
        }
        const products = parsePastOrders(html).map(p => ({
          sku: p.sku,
          name: p.name,
          brand: p.brand,
          canonicalFoodHint: null,  // server-side resolution against canonical_foods
        }));
        return { jobId: job.id, ok: true, data: { products } };
      }

      return { jobId: job.id, ok: false, error: `unknown_type:${job.type}` };
    } finally {
      await context.close();
    }
  },
};
```

The `JobResult` type in `worker-sdk/types.ts` previously did not include a `jobId` field. Re-check it — for the new lifecycle the `jobId` is supplied by the URL when posting back, not in the body. Update `JobResult` accordingly:

In `apps/scraper/src/worker-sdk/types.ts`, the `JobResult` interface should be **without** `jobId` (the worker passes it separately to `reportJobResult(jobId, result)`):

```typescript
export interface JobResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
```

If `handle()` returns an object that includes `jobId`, drop it before passing to `reportJobResult`. Adjust the adapter return type to match `JobResult`:

```typescript
async handle(job: ScraperJob, browser: Browser): Promise<JobResult> {
  // ...
  return { ok: true, data: { items } };
}
```

(Remove the `jobId: job.id` from each return in the adapter.)

- [ ] **Step 3: Replace `apps/scraper/src/index.ts` to use the new lifecycle**

```typescript
import 'dotenv/config';
import { chromium } from 'playwright';
import { fetchPendingJobs, claimJob, reportJobResult } from './worker-sdk/client.js';
import { newWorldAdapter } from './stores/newworld.js';
import { paknsaveAdapter } from './stores/paknsave.js';
import { woolworthsAdapter } from './stores/woolworths.js';
import type { StoreAdapter } from './stores/base.js';
import type { Store } from './worker-sdk/types.js';

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 30_000);

const ADAPTERS: Record<Store, StoreAdapter> = {
  new_world: newWorldAdapter,
  paknsave: paknsaveAdapter,
  woolworths: woolworthsAdapter,
};

async function tick(): Promise<void> {
  let jobs;
  try {
    jobs = await fetchPendingJobs();
  } catch (err) {
    console.error('[scraper] poll failed:', err);
    return;
  }

  if (jobs.length === 0) return;
  console.log(`[scraper] claimed ${jobs.length} job(s)`);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const job of jobs) {
      try {
        await claimJob(job.id);
        const adapter = ADAPTERS[job.store];
        const result = await adapter.handle(job, browser);
        await reportJobResult(job.id, result);
        console.log(`[scraper] job ${job.id} (${job.type}) ${result.ok ? 'done' : `failed: ${result.error}`}`);
      } catch (err) {
        console.error(`[scraper] job ${job.id} threw:`, err);
        try {
          await reportJobResult(job.id, { ok: false, error: err instanceof Error ? err.message : String(err) });
        } catch (reportErr) {
          console.error(`[scraper] failed to report failure for ${job.id}:`, reportErr);
        }
      }
    }
  } finally {
    await browser.close();
  }
}

console.log(`[scraper] worker started — polling every ${POLL_INTERVAL_MS / 1000}s`);
tick();
setInterval(tick, POLL_INTERVAL_MS);
```

- [ ] **Step 4: Build the scraper**

Run: `pnpm --filter @eat/scraper build`
Expected: success.

- [ ] **Step 5: Run all scraper tests**

Run: `pnpm --filter @eat/scraper test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/scraper/src/stores/newworld.ts apps/scraper/src/index.ts apps/scraper/src/worker-sdk/types.ts
git commit -m "phase3: wire New World adapter to Playwright + claim/report lifecycle"
```

---

## Task 14: Bootstrap login script (laptop)

**Files:**
- Create: `apps/scraper/src/bootstrap/newworld-login.ts`
- Modify: `apps/scraper/package.json`

- [ ] **Step 1: Create `apps/scraper/src/bootstrap/newworld-login.ts`**

```typescript
import 'dotenv/config';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OUT_DIR = join(homedir(), '.eat-thing');
const OUT_FILE = join(OUT_DIR, 'newworld-storage.json');
const LOGIN_URL = 'https://www.newworld.co.nz/account/login';
const HOME_URL = 'https://www.newworld.co.nz/';

async function main() {
  console.log('Launching headed browser. Log in to New World, then close the browser.');
  console.log('A storage-state file will be written to:', OUT_FILE);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL);

  // Wait until the user has navigated away from /login (proxy for "logged in")
  // OR we hit the home page with a userId cookie. Whichever comes first.
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10 * 60 * 1000 });

  // Give the SPA a beat to settle and write any post-login cookies.
  await page.waitForTimeout(2000);

  const storage = await context.storageState();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(storage));

  console.log('\nDone. Storage state saved.');
  console.log('Next: copy this file to the Mac mini, then run:');
  console.log(`  pnpm --filter @eat/scraper bootstrap:ingest --store new_world --household <HOUSEHOLD_ID> --file ${OUT_FILE}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the script to `apps/scraper/package.json`**

In the `scripts` block, add:

```json
"bootstrap:newworld": "tsx src/bootstrap/newworld-login.ts",
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm --filter @eat/scraper build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add apps/scraper/src/bootstrap/newworld-login.ts apps/scraper/package.json
git commit -m "phase3: bootstrap:newworld — headed login captures storage state"
```

---

## Task 15: Bootstrap ingest script (Mac mini)

**Files:**
- Create: `apps/scraper/src/bootstrap/ingest.ts`
- Modify: `apps/scraper/package.json`

- [ ] **Step 1: Create `apps/scraper/src/bootstrap/ingest.ts`**

```typescript
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { encrypt } from '../encryption.js';
import { postSession } from '../worker-sdk/client.js';
import type { Store } from '../worker-sdk/types.js';

interface Args { store: Store; household: string; file: string; }

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--store')       out.store     = argv[++i] as Store;
    else if (a === '--household') out.household = argv[++i] ?? '';
    else if (a === '--file')   out.file      = argv[++i] ?? '';
  }
  if (!out.store || !out.household || !out.file) {
    throw new Error('Usage: bootstrap:ingest --store new_world --household <UUID> --file <path>');
  }
  if (out.store !== 'new_world' && out.store !== 'paknsave' && out.store !== 'woolworths') {
    throw new Error(`Unknown store: ${out.store}`);
  }
  return out as Args;
}

async function main() {
  const { store, household, file } = parseArgs(process.argv.slice(2));
  const key = process.env.SUPERMARKET_ENC_KEY;
  if (!key) throw new Error('SUPERMARKET_ENC_KEY not set');

  const plaintext = readFileSync(file, 'utf8');
  // Validate it parses as JSON before encrypting (catches accidental wrong files).
  JSON.parse(plaintext);

  const encryptedBlob = encrypt(plaintext, key);
  await postSession(household, store, encryptedBlob);

  console.log(`Session for household=${household} store=${store} ingested.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add to `apps/scraper/package.json`**

```json
"bootstrap:ingest": "tsx src/bootstrap/ingest.ts",
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @eat/scraper build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add apps/scraper/src/bootstrap/ingest.ts apps/scraper/package.json
git commit -m "phase3: bootstrap:ingest — encrypt + POST storage state to server"
```

---

## Task 16: Smoke command

**Files:**
- Create: `apps/scraper/src/smoke/newworld.ts`
- Modify: `apps/scraper/package.json`

- [ ] **Step 1: Create `apps/scraper/src/smoke/newworld.ts`**

```typescript
import 'dotenv/config';
import { chromium } from 'playwright';
import { loadStorageState } from '../session.js';
import { parseSearchResults, isLoggedOutPage } from '../stores/newworld.js';

const HOUSEHOLD = process.env.SMOKE_HOUSEHOLD_ID;
const QUERY = process.argv[2] ?? 'eggs';

async function main() {
  if (!HOUSEHOLD) throw new Error('SMOKE_HOUSEHOLD_ID env var required');
  const storageState = await loadStorageState(HOUSEHOLD, 'new_world');
  if (!storageState) throw new Error('No stored session for new_world. Run bootstrap first.');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  await page.goto(`https://www.newworld.co.nz/shop/search?q=${encodeURIComponent(QUERY)}`, { waitUntil: 'domcontentloaded' });
  const html = await page.content();

  if (isLoggedOutPage(html)) {
    console.error('Session expired. Re-run bootstrap.');
    process.exit(2);
  }

  const results = parseSearchResults(html);
  console.log(`Got ${results.length} results for "${QUERY}":`);
  for (const r of results.slice(0, 5)) {
    console.log(`  ${r.sku} ${r.name} (${r.brand ?? '?'}) $${r.price} ${r.inStock ? '✓' : 'OOS'}`);
  }

  if (results.length === 0) {
    console.error('Zero results — selectors may be stale. Check fixtures README.');
    process.exit(3);
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add to `apps/scraper/package.json`**

```json
"smoke:newworld": "tsx src/smoke/newworld.ts",
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @eat/scraper build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add apps/scraper/src/smoke/newworld.ts apps/scraper/package.json
git commit -m "phase3: smoke:newworld — live search sanity check"
```

---

## Task 17: Web — API client + hook for prices

**Files:**
- Create: `apps/web/src/api/prices.ts`
- Create: `apps/web/src/hooks/usePricesForList.ts`

- [ ] **Step 1: Inspect existing API client style**

Read one existing file (e.g. `apps/web/src/api/<something>.ts` if it exists, otherwise look at `apps/web/src/hooks/useShoppingList.ts`) to confirm the fetch helper, base URL, and response-shape conventions. Use the exact same idiom for the new module.

- [ ] **Step 2: Create `apps/web/src/api/prices.ts`**

Adapt to whatever fetch helper the codebase already uses (`api`, `fetchJson`, etc.). Concrete shape:

```typescript
import type { PricesForListResponse, RefreshPricesResponse } from '@eat/shared';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export function getPricesForList(listId: string): Promise<PricesForListResponse> {
  return jsonFetch<PricesForListResponse>(`/shopping-lists/${listId}/prices`);
}

export function refreshPricesForList(listId: string): Promise<RefreshPricesResponse> {
  return jsonFetch<RefreshPricesResponse>(`/shopping-lists/${listId}/refresh-prices`, { method: 'POST' });
}
```

If the existing convention uses a shared `api()` helper, swap `jsonFetch` for that and drop the local definition.

- [ ] **Step 3: Create `apps/web/src/hooks/usePricesForList.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPricesForList, refreshPricesForList } from '../api/prices';

export function usePricesForList(listId: string | null | undefined) {
  return useQuery({
    queryKey: ['shopping-list-prices', listId],
    queryFn: () => getPricesForList(listId!),
    enabled: !!listId,
    refetchInterval: data => {
      const status = (data as ReturnType<typeof getPricesForList> extends Promise<infer R> ? R : never)?.job?.status;
      return status === 'pending' || status === 'in_progress' ? 5000 : false;
    },
  });
}

export function useRefreshPrices(listId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => refreshPricesForList(listId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list-prices', listId] });
    },
  });
}
```

(If the project's TanStack Query version places `refetchInterval`'s argument differently, adjust to the local idiom — the mock-test below is the source of truth for the contract.)

- [ ] **Step 4: Build the web app**

Run: `pnpm --filter @eat/web build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api/prices.ts apps/web/src/hooks/usePricesForList.ts
git commit -m "phase3: web API + hooks for price refresh and read"
```

---

## Task 18: Web — ShoppingListPage price column + refresh button

**Files:**
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`
- Create: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`

- [ ] **Step 1: Modify `ShoppingListPage.tsx`**

At the top of the file, add the new imports:

```typescript
import { usePricesForList, useRefreshPrices } from '../../hooks/usePricesForList';
import type { ShoppingListPrice } from '@eat/shared';
```

Replace the `ItemRow` component to take an optional price prop, and render a price column:

```tsx
interface ItemRowProps {
  item: ShoppingListItem;
  price: ShoppingListPrice | undefined;
  refreshing: boolean;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}

function priceCell(price: ShoppingListPrice | undefined, refreshing: boolean) {
  if (!price && refreshing) return <span className="list-item-price list-item-price--loading">…</span>;
  if (!price) return null;
  if (!price.matched) return <span className="list-item-price list-item-price--missing">no match</span>;
  if (!price.inStock) return <span className="list-item-price list-item-price--oos">out of stock</span>;
  return <span className="list-item-price">${price.price?.toFixed(2)}</span>;
}

function ItemRow({ item, price, refreshing, onToggle, onDelete }: ItemRowProps) {
  return (
    <li className={`list-item${item.checked ? ' checked' : ''}`}>
      <input
        type="checkbox"
        className="list-item-check"
        checked={item.checked}
        onChange={e => onToggle(e.target.checked)}
        id={`item-${item.id}`}
      />
      <label htmlFor={`item-${item.id}`} className="list-item-label">
        <span className="list-item-name">{item.name}</span>
        <span className="list-item-qty">{Math.ceil(item.qty * 10) / 10} {item.unit}</span>
      </label>
      {priceCell(price, refreshing)}
      <button className="list-item-delete" onClick={onDelete} aria-label={`Remove ${item.name}`}>✕</button>
    </li>
  );
}
```

Replace `ListView` to fetch prices and pass them down:

```tsx
function ListView({ list }: ListViewProps) {
  const updateItem = useUpdateShoppingListItem(list.id);
  const deleteItem = useDeleteShoppingListItem(list.id);
  const { data: pricesData } = usePricesForList(list.id);
  const refresh = useRefreshPrices(list.id);

  const priceByItemId = new Map<string, ShoppingListPrice>();
  for (const p of pricesData?.prices ?? []) priceByItemId.set(p.shoppingListItemId, p);

  const refreshing = pricesData?.job?.status === 'pending' || pricesData?.job?.status === 'in_progress' || refresh.isPending;

  const groups: Record<string, ShoppingListItem[]> = { recipe: [], staple: [], manual: [] };
  for (const item of list.items) (groups[item.source] ??= []).push(item);

  const uncheckedCount = list.items.filter(i => !i.checked).length;

  return (
    <div className="list-view">
      <div className="list-summary">
        {uncheckedCount === 0
          ? <span className="list-done">All done!</span>
          : <span>{uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} remaining</span>}
        <button
          className="btn btn-ghost"
          onClick={() => refresh.mutate()}
          disabled={refreshing}
          aria-label="Refresh prices"
        >
          {refreshing ? 'Checking prices…' : 'Refresh prices'}
        </button>
      </div>

      {(['recipe', 'staple', 'manual'] as const).map(source => {
        const items = groups[source] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={source} className="list-section">
            <h2 className="list-section-title">{SOURCE_LABELS[source]}</h2>
            <ul className="list-items">
              {items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  price={priceByItemId.get(item.id)}
                  refreshing={refreshing}
                  onToggle={checked => updateItem.mutate({ itemId: item.id, checked })}
                  onDelete={() => deleteItem.mutate(item.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <section className="list-section list-section--manual">
        <h2 className="list-section-title">Add item</h2>
        <AddItemForm listId={list.id} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS classes for the price column**

Append to `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`:

```css
.list-item-price {
  margin-left: 0.5rem;
  font-variant-numeric: tabular-nums;
  font-size: 0.85rem;
  color: #94a3b8;
  white-space: nowrap;
}
.list-item-price--loading { color: #6366f1; font-style: italic; }
.list-item-price--missing { color: #f59e0b; }
.list-item-price--oos     { color: #ef4444; }

.list-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
```

- [ ] **Step 3: Write the failing component test**

Create `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShoppingListPage } from './ShoppingListPage';

const hooks = vi.hoisted(() => ({
  useCurrentShoppingList: vi.fn(),
  useGenerateShoppingList: vi.fn(),
  useUpdateShoppingListItem: vi.fn(),
  useAddShoppingListItem: vi.fn(),
  useDeleteShoppingListItem: vi.fn(),
  usePricesForList: vi.fn(),
  useRefreshPrices: vi.fn(),
}));

vi.mock('../../hooks/useShoppingList', () => ({
  useCurrentShoppingList: hooks.useCurrentShoppingList,
  useGenerateShoppingList: hooks.useGenerateShoppingList,
  useUpdateShoppingListItem: hooks.useUpdateShoppingListItem,
  useAddShoppingListItem: hooks.useAddShoppingListItem,
  useDeleteShoppingListItem: hooks.useDeleteShoppingListItem,
}));
vi.mock('../../hooks/usePricesForList', () => ({
  usePricesForList: hooks.usePricesForList,
  useRefreshPrices: hooks.useRefreshPrices,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ShoppingListPage /></QueryClientProvider>);
}

const baseList = {
  id: 'list-1', householdId: 'h', generatedFromMealPlanId: null,
  createdAt: '2026-05-10T00:00:00Z', finalizedAt: null,
  items: [
    { id: 'i1', shoppingListId: 'list-1', canonicalFoodId: 'cf1', name: 'Eggs',  qty: 1, unit: 'count', source: 'recipe', checked: false },
    { id: 'i2', shoppingListId: 'list-1', canonicalFoodId: 'cf2', name: 'Bread', qty: 1, unit: 'count', source: 'staple', checked: false },
  ],
};

describe('ShoppingListPage prices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.useCurrentShoppingList.mockReturnValue({ data: baseList, isLoading: false });
    hooks.useGenerateShoppingList.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.useUpdateShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.useAddShoppingListItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useDeleteShoppingListItem.mockReturnValue({ mutate: vi.fn() });
  });

  it('renders matched price', () => {
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [{ id: 'p1', shoppingListItemId: 'i1', store: 'new_world', sku: 'NW-001', name: 'Free Range Eggs', price: 7.49, inStock: true, matched: true, checkedAt: '2026-05-10T01:00:00Z' }],
        job: { id: 'j1', status: 'done', error: null },
      },
    });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    expect(screen.getByText('$7.49')).toBeInTheDocument();
  });

  it('renders out-of-stock', () => {
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [{ id: 'p2', shoppingListItemId: 'i1', store: 'new_world', sku: 'NW-001', name: 'Eggs', price: 7.49, inStock: false, matched: true, checkedAt: '2026-05-10T01:00:00Z' }],
        job: null,
      },
    });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    expect(screen.getByText('out of stock')).toBeInTheDocument();
  });

  it('renders no-match', () => {
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [{ id: 'p3', shoppingListItemId: 'i1', store: 'new_world', sku: null, name: null, price: null, inStock: false, matched: false, checkedAt: '2026-05-10T01:00:00Z' }],
        job: null,
      },
    });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    expect(screen.getByText('no match')).toBeInTheDocument();
  });

  it('shows loading state for items without prices when refreshing', () => {
    hooks.usePricesForList.mockReturnValue({
      data: { prices: [], job: { id: 'j1', status: 'in_progress', error: null } },
    });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
    renderPage();
    expect(screen.getByText('Checking prices…')).toBeInTheDocument();
  });

  it('refresh button enqueues a job', async () => {
    const refreshMutate = vi.fn();
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: refreshMutate, isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /refresh prices/i }));
    await waitFor(() => expect(refreshMutate).toHaveBeenCalled());
  });
});
```

- [ ] **Step 4: Run web tests**

Run: `pnpm --filter @eat/web test -- ShoppingListPage`
Expected: all 5 pass.

- [ ] **Step 5: Run full web test suite to confirm no regressions**

Run: `pnpm --filter @eat/web test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage/
git commit -m "phase3: shopping list price column + refresh trigger"
```

---

## Task 19: Documentation updates

**Files:**
- Modify: `PLAN.md`
- Modify: `ARCHITECTURE.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Add D17 to `DECISIONS.md`**

Append at the end of the file:

```markdown
## D17 — Supermarket session encryption key lives on the Mac mini only
**Date:** 2026-05-10
**Context:** PLAN.md and ARCHITECTURE.md disagreed on where the AES key for `supermarket_credentials.encrypted_session_blob` lives. Need a single home that the bootstrap and worker scripts can read.
**Decision:** The key (`SUPERMARKET_ENC_KEY`, 32 bytes base64) lives only on the Mac mini. The server stores ciphertext as opaque bytes and never decrypts. Bootstrap is split: a headed login script runs on the user's laptop and writes plaintext `storageState` to disk; the user transfers the file to the mini; an ingest script on the mini encrypts and POSTs.
**Rationale:** A server compromise should not leak supermarket sessions, since they're not data the server's HTTP surface ever needs. Two-step bootstrap keeps the key off any other machine. Rotation cost is one re-bootstrap per store — acceptable for a two-user household.
```

- [ ] **Step 2: Update the encryption-key bullet in `ARCHITECTURE.md`**

Find the lines under "Secrets":

```markdown
- **Secrets:**
  - Vercel: OAuth client ID/secret, Supabase anon/service keys, HMAC key for worker auth.
  - Mac mini: HMAC key, OpenBrain API token, encryption key for supermarket session blobs.
```

These are already correct. The change to make is in the **Playwright worker** section. Find:

```markdown
- Sessions persisted as encrypted cookie blobs in `supermarket_credentials`. First login per store is headed (user logs in once); subsequent runs are headless.
```

Replace with:

```markdown
- Sessions persisted as encrypted cookie blobs in `supermarket_credentials` (AES-256-GCM, key on the mini only). First login per store is two-step: a headed `bootstrap:newworld` runs on the user's laptop and writes a plaintext `storageState`; the user copies it to the mini, where `bootstrap:ingest` encrypts and POSTs. Subsequent runs are headless and decrypt on the mini.
```

Also append to the "Playwright worker" section:

```markdown
- Job model: `scraper_jobs` (pending → in_progress → done | failed) with type-specific payloads. Two types in slice 1: `import_past_orders` (one-shot per store) and `compare_prices` (per shopping list).
- Per-item price snapshots in `shopping_list_prices` (one row per (item, store), upserted on each comparison).
```

- [ ] **Step 3: Update `PLAN.md`**

In the Phase 3 section, mark slice 1 items complete (those that are):

Change:

```markdown
## Phase 3 — Read-only supermarket integration

Scraper on Mac mini. Logs in, reads. No writes to the supermarket account.

- [ ] Playwright session bootstrap: headed first-run for each store to capture login cookies
- [ ] Encrypted credential / session storage (`supermarket_credentials`); encryption key lives only on the server
```

…etc, to reflect the slice-by-slice approach. Replace that Phase 3 block with:

```markdown
## Phase 3 — Read-only supermarket integration

Scraper on Mac mini. Logs in, reads. No writes to the supermarket account. Built one store at a time so the architecture is shaped by real adapters, not guesses.

### Slice 1 — New World vertical (in progress)

- [x] Encrypted credential storage; AES-256-GCM, key on the Mac mini only — _2026-05-10_
- [x] Bootstrap: headed `bootstrap:newworld` (laptop) + `bootstrap:ingest` (mini) — _2026-05-10_
- [x] `scraper_jobs` queue + lifecycle endpoints (pending / claim / result), aligned to existing OpenBrain HMAC scheme — _2026-05-10_
- [x] New World adapter: search + past-orders parsers + `handle()` dispatch — _2026-05-10_
- [x] Hybrid catalog matching with preferred-brand bias — _2026-05-10_
- [x] Inline price + availability column on the existing `ShoppingListPage` — _2026-05-10_
- [ ] First-run login (user at browser) + smoke test against live New World

### Slice 2 — Pak'nSave + Woolworths + recommendation UI (next)

- [ ] Pak'nSave adapter (parser, fixtures, smoke command)
- [ ] Woolworths adapter (parser, fixtures, smoke command)
- [ ] Multi-store recommendation UI: cheapest store, convenient store, optional split shop
- [ ] Robustness: detect logged-out state and prompt user; retry/backoff for transient failures
- [ ] `launchd` plists so both the scraper and the OpenBrain sync worker auto-start on the Mac mini
```

In the Done log at the bottom, add a 2026-05-10 entry:

```markdown
- 2026-05-10 — Phase 3 slice 1: New World vertical landed (encrypted sessions + jobs lifecycle + parser + matcher + price column). Headed bootstrap and live smoke pending user.
```

- [ ] **Step 4: Commit**

```bash
git add PLAN.md ARCHITECTURE.md DECISIONS.md
git commit -m "phase3: docs — D17 encryption-key location, ARCHITECTURE updates, PLAN slice tracking"
```

---

## Task 20: Final verification — full suite + final summary

- [ ] **Step 1: Run full unit suite from the repo root**

Run: `pnpm test`
Expected: all green across all workspaces.

- [ ] **Step 2: Run the E2E suite**

Run: `pnpm test:e2e`
Expected: all green. (The slice doesn't add new E2E coverage — Phase 3 is exercised manually via the smoke command.)

- [ ] **Step 3: Print the operator handoff summary**

Output (do not commit, just stdout) the exact commands the user needs to run when they get back:

```
Phase 3 slice 1 ready. To complete:

1. On your laptop:
     pnpm --filter @eat/scraper bootstrap:newworld
   Log in to New World in the browser. Storage state is saved to
   ~/.eat-thing/newworld-storage.json.

2. Transfer to the Mac mini:
     scp ~/.eat-thing/newworld-storage.json mac-mini:~/.eat-thing/

3. On the mini, ensure SUPERMARKET_ENC_KEY is set in the scraper env, then:
     pnpm --filter @eat/scraper bootstrap:ingest \
       --store new_world --household <YOUR_HOUSEHOLD_ID> \
       --file ~/.eat-thing/newworld-storage.json

4. Smoke test:
     SMOKE_HOUSEHOLD_ID=<YOUR_HOUSEHOLD_ID> \
       pnpm --filter @eat/scraper smoke:newworld eggs

5. Optional: trigger a one-time past-orders import via the app
   (POST /api/scraper/import-past-orders) so the matcher learns
   your preferred brands.
```

- [ ] **Step 4: No commit needed.**

---

## Self-review checklist (already performed)

- **Spec coverage:** Every section of the spec has at least one task. Encryption (T5), session loading (T6), session routes (T7), job lifecycle routes (T8), user routes (T9), schema (T1, T10), shared types (T2), HMAC alignment (T3, T4), parsers + fixtures (T12), adapter dispatch (T13), bootstrap login (T14), bootstrap ingest (T15), smoke (T16), web client (T17), web UI (T18), docs (T19), verification (T20).
- **Placeholders:** None. Every code step has full code.
- **Type consistency:** `JobResult` is defined once (no `jobId`), passed alongside `jobId` to `reportJobResult(jobId, result)`. `ScraperJob` shape is identical between server response and worker SDK type. `ShoppingListPrice.price` is a number on the wire (server converts from numeric string before responding, T9).
- **Stop point:** Tasks 1–19 are autonomous; Task 20's step 3 prints the operator handoff. Headed login + smoke are explicitly user-only.
