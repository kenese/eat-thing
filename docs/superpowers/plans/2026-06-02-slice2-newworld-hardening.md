# Slice 2 New World Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the New World scraper flow so logged-out sessions surface clearly on the Shopping List page, transient scraper failures retry with visible status, and the Mac mini can run the built scraper worker under `launchd`.

**Architecture:** Keep the current job queue and Shopping List status surfaces, but extend the shared job summary contract with structured failure metadata. Implement retries inline in the scraper worker, not by requeueing jobs. Reuse the Shopping List sidebar and `AgentStatusCard` for user-facing state. Add a production `launchd` plist that runs `node dist/index.js`.

**Tech Stack:** TypeScript, Playwright, Express, Drizzle/Postgres, React 19, TanStack Query, Vitest, Playwright E2E, `launchd`.

---

### Task 1: Add Shared Scraper Failure Types and Job Summaries

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/scraper/src/worker-sdk/types.ts`
- Test: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`

- [ ] **Step 1: Add shared scraper failure types to `packages/shared/src/index.ts`**

Add the shared failure and job-summary types near the existing scraper/shopping-list response types:

```ts
export type ScraperErrorCode =
  | 'session_expired'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'navigation_timeout'
  | 'network_error'
  | 'parser_error'
  | 'invalid_payload'
  | 'no_session'
  | 'unknown';

export interface ScraperJobFailureSummary {
  code: ScraperErrorCode;
  message: string;
  retryable: boolean;
  attempt: number;
  maxAttempts: number;
}

export interface ScraperJobSummary {
  id: string;
  status: ScraperJobStatus;
  error: string | null;
  failure: ScraperJobFailureSummary | null;
  retrying: boolean;
}
```

Update:

```ts
export interface PricesForListResponse {
  prices: ShoppingListPrice[];
  job: ScraperJobSummary | null;
}

export interface CartResultResponse {
  job: ScraperJobSummary | null;
  result: CartJobResult | null;
}
```

- [ ] **Step 2: Mirror the worker-side failure shape in `apps/scraper/src/worker-sdk/types.ts`**

Extend the worker types with a richer failure payload:

```ts
export interface ScraperFailure {
  code: ScraperErrorCode;
  message: string;
  retryable: boolean;
  attempt: number;
  maxAttempts: number;
}

export interface JobResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  failure?: ScraperFailure;
}
```

Also export:

```ts
export type ScraperErrorCode = ...;
```

Use the exact same union values as `packages/shared/src/index.ts`.

- [ ] **Step 3: Write the first failing Shopping List UI test for a session-expired job**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`, add a test inside `describe('ShoppingListPage prices', ...)`:

```ts
it('shows a New World re-login prompt when the latest job failed with session_expired', () => {
  hooks.usePricesForList.mockReturnValue({
    data: {
      prices: [],
      job: {
        id: 'job-1',
        status: 'failed',
        error: 'session_expired',
        retrying: false,
        failure: {
          code: 'session_expired',
          message: 'New World session expired',
          retryable: false,
          attempt: 1,
          maxAttempts: 3,
        },
      },
    },
  });
  hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });

  renderPage();

  expect(screen.getByText(/new world needs you to sign in again on the mac mini/i)).toBeInTheDocument();
  expect(screen.getByText(/re-run bootstrap and ingest your session/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the focused web test to verify it fails**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/ShoppingListPage/ShoppingListPage.test.tsx
```

Expected: FAIL because the mocked `job.failure` shape is not yet reflected in the component/types.

- [ ] **Step 5: Implement only the type changes needed to compile the test setup**

Update imports and mocked job shapes as needed so the new test file compiles cleanly with the added shared types. Do **not** implement the UI prompt yet.

- [ ] **Step 6: Re-run the focused web test**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/ShoppingListPage/ShoppingListPage.test.tsx
```

Expected: still FAIL, but now because the prompt is not rendered yet rather than because of type errors.


### Task 2: Surface Logged-out Prompt on Shopping List

**Files:**
- Modify: `apps/server/src/routes/shopping-lists.ts`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`
- Test: `apps/web/tests/app.spec.ts`

- [ ] **Step 1: Add the failing E2E assertion for a session-expired price job**

In `apps/web/tests/app.spec.ts`, add a new authenticated route test near the existing Shopping List coverage:

```ts
test('shopping list shows the Mac-mini sign-in prompt when New World session is expired', async ({ page }) => {
  await stubAuthedShell(page);
  await page.route('**/api/shopping-lists/current', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SHOPPING_LIST) }),
  );
  await page.route(`**/api/shopping-lists/${LIST_ID}/prices`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        prices: [],
        job: {
          id: 'job-expired',
          status: 'failed',
          error: 'session_expired',
          retrying: false,
          failure: {
            code: 'session_expired',
            message: 'New World session expired',
            retryable: false,
            attempt: 1,
            maxAttempts: 3,
          },
        },
      }),
    }),
  );

  await page.goto('/list');
  await expect(page.getByText(/new world needs you to sign in again on the mac mini/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the focused E2E grep to verify it fails**

Run:

```bash
pnpm --filter @eat/web exec playwright test tests/app.spec.ts --grep "session is expired"
```

Expected: FAIL because the prompt is not yet rendered.

- [ ] **Step 3: Extend the server’s job summaries in `apps/server/src/routes/shopping-lists.ts`**

Update both the `/:id/cart-result` and `/:id/prices` handlers so they return the richer job summary:

```ts
function toJobSummary(job: {
  id: string;
  status: string;
  error: string | null;
  result: Record<string, unknown> | null;
}) {
  const failure = job.result && typeof job.result === 'object' && 'failure' in job.result
    ? job.result.failure as Record<string, unknown>
    : null;

  return {
    id: job.id,
    status: job.status,
    error: job.error,
    retrying: job.status === 'in_progress' && !!failure?.retryable,
    failure: failure ? {
      code: String(failure.code),
      message: String(failure.message),
      retryable: Boolean(failure.retryable),
      attempt: Number(failure.attempt),
      maxAttempts: Number(failure.maxAttempts),
    } : null,
  };
}
```

Then replace:

```ts
job: job ? { id: job.id, status: job.status, error: job.error } : null,
```

with:

```ts
job: job ? toJobSummary(job) : null,
```

Update the selects to include `result` in the prices route as well.

- [ ] **Step 4: Render the session-expired prompt in `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`**

Add derived state:

```ts
const sessionExpired = job?.failure?.code === 'session_expired';
```

Update the failed message branch:

```ts
: agentState === 'failed'
  ? sessionExpired
    ? 'New World needs a fresh sign-in on the Mac mini.'
    : 'Last price check failed. Run refresh to try again.'
```

Render an inline prompt under the store card and above the send button:

```tsx
{sessionExpired && (
  <div className="form-error" role="alert">
    <strong>New World needs you to sign in again on the Mac mini.</strong>
    <div>Re-run bootstrap and ingest your session, then try again.</div>
  </div>
)}
```

Do not introduce a new global banner or modal.

- [ ] **Step 5: Update the focused unit test assertions**

Ensure the test added in Task 1 now passes, and add a second assertion that the `AgentStatusCard` message also shifts to the session-expired copy.

- [ ] **Step 6: Re-run the focused web and E2E tests**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/ShoppingListPage/ShoppingListPage.test.tsx
pnpm --filter @eat/web exec playwright test tests/app.spec.ts --grep "session is expired"
```

Expected: PASS.


### Task 3: Add Retry Classification and Backoff in the Scraper Worker

**Files:**
- Modify: `apps/scraper/src/index.ts`
- Modify: `apps/scraper/src/stores/newworld.ts`
- Modify: `apps/scraper/src/worker-sdk/types.ts`
- Modify: `apps/server/src/routes/scraper.ts`
- Test: `apps/scraper/src/index.test.ts` (new)
- Test: `apps/scraper/src/stores/newworld.test.ts`

- [ ] **Step 1: Create a new worker retry test file**

Create `apps/scraper/src/index.test.ts` with helper-level tests for retry classification and backoff sequencing. Structure it around extracted pure helpers that you will add in Step 3.

Start with tests like:

```ts
import { describe, it, expect } from 'vitest';
import { classifyWorkerFailure, retryDelayMs, shouldRetryFailure } from './index.js';

describe('classifyWorkerFailure', () => {
  it('marks session_expired as non-retryable', () => {
    expect(classifyWorkerFailure({ ok: false, error: 'session_expired' }, 1, 3)).toMatchObject({
      code: 'session_expired',
      retryable: false,
      attempt: 1,
      maxAttempts: 3,
    });
  });

  it('marks Playwright timeout errors as retryable navigation failures', () => {
    const err = new Error('page.goto: Timeout 15000ms exceeded');
    expect(classifyWorkerFailure(err, 2, 3)).toMatchObject({
      code: 'navigation_timeout',
      retryable: true,
      attempt: 2,
      maxAttempts: 3,
    });
  });
});

describe('retryDelayMs', () => {
  it('uses the agreed 1s then 3s schedule', () => {
    expect(retryDelayMs(2)).toBe(1000);
    expect(retryDelayMs(3)).toBe(3000);
  });
});

describe('shouldRetryFailure', () => {
  it('retries only retryable failures with attempts remaining', () => {
    expect(shouldRetryFailure({ retryable: true, attempt: 1, maxAttempts: 3 } as any)).toBe(true);
    expect(shouldRetryFailure({ retryable: true, attempt: 3, maxAttempts: 3 } as any)).toBe(false);
    expect(shouldRetryFailure({ retryable: false, attempt: 1, maxAttempts: 3 } as any)).toBe(false);
  });
});
```

- [ ] **Step 2: Add a failing New World adapter test for structured `session_expired`**

In `apps/scraper/src/stores/newworld.test.ts`, add:

```ts
describe('session-expired failure shape', () => {
  it('returns a stable structured failure for logged-out pages', () => {
    const failure = {
      code: 'session_expired',
      message: 'New World session expired',
      retryable: false,
      attempt: 1,
      maxAttempts: 3,
    };
    expect(failure).toMatchObject({
      code: 'session_expired',
      retryable: false,
    });
  });
});
```

This is mostly a pin for the exact shared code string while the worker helpers are being introduced.

- [ ] **Step 3: Extract retry helpers from `apps/scraper/src/index.ts`**

Refactor `index.ts` so it exports pure helpers:

```ts
export const MAX_JOB_ATTEMPTS = 3;

export function retryDelayMs(attempt: number): number {
  if (attempt <= 2) return 1000;
  return 3000;
}

export function shouldRetryFailure(failure: ScraperFailure): boolean {
  return failure.retryable && failure.attempt < failure.maxAttempts;
}

export function classifyWorkerFailure(
  err: unknown,
  attempt: number,
  maxAttempts: number,
): ScraperFailure {
  // map structured JobResult failures through
  // map timeout/network/429/5xx to retryable codes
  // default to unknown non-retryable
}
```

Guard worker startup so importing the module in tests does not start polling:

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`[scraper] worker started — polling every ${POLL_INTERVAL_MS / 1000}s`);
  tick();
  setInterval(tick, POLL_INTERVAL_MS);
}
```

- [ ] **Step 4: Implement inline retry loop in `tick()`**

Replace the single-attempt per job block with:

```ts
for (const job of jobs) {
  await claimJob(job.id);

  for (let attempt = 1; attempt <= MAX_JOB_ATTEMPTS; attempt++) {
    try {
      const adapter = ADAPTERS[job.store];
      const result = await adapter.handle(job, browser);

      if (result.ok) {
        await reportJobResult(job.id, result);
        break;
      }

      const failure = classifyWorkerFailure(result, attempt, MAX_JOB_ATTEMPTS);
      if (!shouldRetryFailure(failure)) {
        await reportJobResult(job.id, { ok: false, error: failure.code, failure });
        break;
      }

      await new Promise(resolve => setTimeout(resolve, retryDelayMs(attempt + 1)));
    } catch (err) {
      const failure = classifyWorkerFailure(err, attempt, MAX_JOB_ATTEMPTS);
      if (!shouldRetryFailure(failure)) {
        await reportJobResult(job.id, { ok: false, error: failure.code, failure });
        break;
      }

      await new Promise(resolve => setTimeout(resolve, retryDelayMs(attempt + 1)));
    }
  }
}
```

Keep the existing browser lifetime per poll tick.

- [ ] **Step 5: Return stable failure codes from `apps/scraper/src/stores/newworld.ts`**

Normalize the known failures:

```ts
if (!storageState) {
  return { ok: false, error: 'no_session' };
}

if (isLoggedOutPage(html)) {
  return { ok: false, error: 'session_expired' };
}

if (!payload || !Array.isArray(payload.items)) {
  return { ok: false, error: 'invalid_payload' };
}
```

Where parser/site-drift is detectable, prefer throwing or returning stable strings like `parser_error` rather than raw ad hoc message text.

- [ ] **Step 6: Persist structured failure details from `apps/server/src/routes/scraper.ts`**

In `POST /jobs/:id/result`, when `ok === false`, store the failure payload in `result` and keep the summary code in `error`:

```ts
const failure = req.body.failure ?? null;

await db
  .update(scraperJobs)
  .set({
    status: ok ? 'done' : 'failed',
    result: ok ? data ?? null : failure ? { failure } : null,
    error: ok ? null : (error ?? 'unknown'),
    completedAt: new Date(),
  })
```

This is additive and avoids a migration.

- [ ] **Step 7: Run the focused scraper and server tests**

Run:

```bash
pnpm --filter @eat/scraper test -- src/index.test.ts src/stores/newworld.test.ts
pnpm --filter @eat/server test -- src/routes/scraper.test.ts src/routes/shopping-lists.test.ts
```

Expected: PASS after minimal fixes.


### Task 4: Show Retrying Status on Shopping List

**Files:**
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`
- Modify: `apps/web/tests/app.spec.ts`

- [ ] **Step 1: Add the failing Shopping List unit test for retrying status**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`, add:

```ts
it('shows retrying attempt status while a scraper job is being retried', () => {
  hooks.usePricesForList.mockReturnValue({
    data: {
      prices: [],
      job: {
        id: 'job-2',
        status: 'in_progress',
        error: null,
        retrying: true,
        failure: {
          code: 'navigation_timeout',
          message: 'Retrying after timeout',
          retryable: true,
          attempt: 2,
          maxAttempts: 3,
        },
      },
    },
  });
  hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });

  renderPage();

  expect(screen.getByText(/retrying price check at new world/i)).toBeInTheDocument();
  expect(screen.getByText(/attempt 2 of 3/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Add the failing E2E assertion for retrying status**

In `apps/web/tests/app.spec.ts`, add:

```ts
test('shopping list shows retrying status while a New World price job is retried', async ({ page }) => {
  await stubAuthedShell(page);
  await page.route('**/api/shopping-lists/current', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SHOPPING_LIST) }),
  );
  await page.route(`**/api/shopping-lists/${LIST_ID}/prices`, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        prices: [],
        job: {
          id: 'job-retrying',
          status: 'in_progress',
          error: null,
          retrying: true,
          failure: {
            code: 'navigation_timeout',
            message: 'Retrying after timeout',
            retryable: true,
            attempt: 2,
            maxAttempts: 3,
          },
        },
      }),
    }),
  );

  await page.goto('/list');
  await expect(page.getByText(/retrying price check at new world/i)).toBeVisible();
  await expect(page.getByText(/attempt 2 of 3/i)).toBeVisible();
});
```

- [ ] **Step 3: Implement retry-aware messaging in `ShoppingListPage.tsx`**

Replace the current `agentMessage` derivation with a retry-aware branch:

```ts
const retryFailure = job?.retrying ? job.failure : null;
const retryAttempt = retryFailure?.attempt ?? null;
const retryMax = retryFailure?.maxAttempts ?? null;

const agentMessage =
  job?.retrying && retryFailure
    ? `Retrying price check${storeLabel ? ' at ' + storeLabel.name : ''}… attempt ${retryAttempt} of ${retryMax}`
    : agentState === 'running'
      ? `Checking prices${storeLabel ? ' at ' + storeLabel.name : ''}.`
      : agentState === 'failed'
        ? sessionExpired
          ? 'New World needs a fresh sign-in on the Mac mini.'
          : 'Last price check failed. Run refresh to try again.'
        : `I'll log in, drop everything into your cart, choose the window, and stop before checkout for your okay.`;
```

Keep `AgentStatusCard state="running"` during retry.

- [ ] **Step 4: Re-run the focused web and E2E tests**

Run:

```bash
pnpm --filter @eat/web test -- src/pages/ShoppingListPage/ShoppingListPage.test.tsx
pnpm --filter @eat/web exec playwright test tests/app.spec.ts --grep "retrying status|session is expired"
```

Expected: PASS.


### Task 5: Add Production `launchd` Service and Install Docs

**Files:**
- Create: `apps/scraper/launchd/com.eat-thing.scraper.plist`
- Modify: `ARCHITECTURE.md`
- Modify: `PLAN.md`

- [ ] **Step 1: Create the checked-in scraper plist**

Create `apps/scraper/launchd/com.eat-thing.scraper.plist` with a built-worker command. Use the repo path and `node dist/index.js`, not `tsx watch`.

Template:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.eat-thing.scraper</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>cd /Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/scraper && pnpm start</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/scraper</string>

    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/Users/keneselautusi/Library/Logs/eat-thing-scraper.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/keneselautusi/Library/Logs/eat-thing-scraper-error.log</string>
  </dict>
</plist>
```

Use `pnpm start` because `apps/scraper/package.json` already maps it to `node dist/index.js`.

- [ ] **Step 2: Update architecture docs with real install/reload steps**

In `ARCHITECTURE.md`, replace the “launchd supervision planned until the scraper plist lands” wording with the actual checked-in scraper plist and a short operational note:

```md
- `apps/scraper/launchd/com.eat-thing.scraper.plist` runs the built scraper worker on the Mac mini via `pnpm start`.
- Install/update with `launchctl unload ~/Library/LaunchAgents/com.eat-thing.scraper.plist 2>/dev/null || true`, copy the plist, then `launchctl load ~/Library/LaunchAgents/com.eat-thing.scraper.plist`.
```

- [ ] **Step 3: Verify the plist is well-formed and the scraper still builds**

Run:

```bash
plutil -lint apps/scraper/launchd/com.eat-thing.scraper.plist
pnpm --filter @eat/scraper build
```

Expected:
- `OK` from `plutil`
- successful TypeScript build

- [ ] **Step 4: Leave `PLAN.md` untouched for now**

Do not mark Slice 2 done until the full verification in Task 6, and do not claim the smoke test passed unless it actually runs with live credentials.


### Task 6: Full Verification and Plan Update

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Run focused scraper smoke if credentials are available**

Run:

```bash
pnpm --filter @eat/scraper smoke:newworld
```

Expected: PASS against the live New World session.

If it cannot run because the Mac mini session or credentials are unavailable, record the exact reason in the final summary and do not mark the slice fully complete in `PLAN.md`.

- [ ] **Step 2: Run the full required repo suites**

Run:

```bash
pnpm test
pnpm test:e2e
```

Expected:
- all Vitest suites pass
- all Playwright E2E tests pass

- [ ] **Step 3: Update `PLAN.md` only after verification passes**

If `pnpm test` and `pnpm test:e2e` pass, update Phase 3 Slice 2:

```md
### Slice 2 — Hardening (complete)

- [x] Robustness: detect logged-out state and prompt user; retry/backoff for transient failures — _2026-06-02_
- [x] `launchd` plist so the scraper auto-starts on the Mac mini — _2026-06-02_
```

And add a Done entry summarizing:
- structured session-expired prompt
- transient retry/backoff
- checked-in scraper plist
- whether `smoke:newworld` passed or remained environment-blocked

- [ ] **Step 4: Final verification snapshot**

Run:

```bash
git status --short
```

Expected: only the intended Slice 2 changes and any unrelated preserved user edits.

