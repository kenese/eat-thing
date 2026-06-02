# Slice 2 — New World Hardening and Mac-mini Service Design

**Date:** 2026-06-02

**Goal:** Make the existing New World scraper flow operationally reliable by surfacing logged-out sessions clearly in the Shopping List UI, retrying transient worker failures with visible status, and checking in a production `launchd` plist for the Mac mini scraper worker.

**Scope:** New World-first. This slice hardens the existing `compare_prices` and `add_to_cart` job flow without introducing multi-store orchestration, new product surfaces, or delivery-slot work.

**Out of scope:**
- Pak'nSave / Woolworths hardening
- Global app banners for scraper failures
- New shopping-list data model changes unrelated to scraper status
- Delivery-window integration
- `/shops` route design

## Context

The current scraper worker in [apps/scraper/src/index.ts](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/scraper/src/index.ts) claims pending jobs, runs a store adapter, and reports either `{ ok: true, data }` or `{ ok: false, error }`. The New World adapter in [apps/scraper/src/stores/newworld.ts](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/scraper/src/stores/newworld.ts) already returns `session_expired` in some paths, but the result shape is only a plain string and the Shopping List UI in [apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx) only distinguishes `pending` / `in_progress` / `failed` at a coarse level.

The result is a reliability gap:
- transient errors fail too early instead of smoothing over common Playwright/network hiccups
- users do not get a specific “sign in again on the Mac mini” prompt when the New World session expires
- the Mac mini service is still documented as planned rather than shipped

## Recommended approach

Use the existing job queue and status surface, but make failure handling structured and explicit:

1. Add machine-readable scraper error metadata and retry state to job results.
2. Keep retries inside one claimed worker job with short exponential backoff.
3. Surface retry and session-expired messaging on the Shopping List page near the store and cart actions.
4. Check in a production `launchd` plist that runs the built scraper worker on the Mac mini.

This is intentionally a narrow hardening slice. It improves the reliability of the existing New World vertical without pulling in a broader cross-store abstraction.

## Alternatives considered

### 1. Minimal targeted hardening (recommended)

- Extend the current worker result contract with structured error codes and retry metadata.
- Keep retry logic local to the worker process.
- Reuse the existing Shopping List `AgentStatusCard` and store sidebar for status display.

**Why chosen:** smallest change that materially improves behavior while preserving existing job endpoints and UI composition.

### 2. Cross-store resilience layer now

- Generalize retry policy and failure taxonomy for all current and future stores.
- Add a broader “scraper control plane” abstraction to server and UI.

**Why not now:** over-scoped relative to the current New World-only operational need. It would create more surface area than the user value demands today.

### 3. Ops-only hardening

- Add `launchd` and keep current runtime behavior.

**Why not now:** improves uptime, but still leaves users stuck with opaque failures and no retry/session-expired guidance.

## User-facing behavior

### Retryable transient failures

When a price-refresh or send-to-cart job hits a transient failure:
- the worker retries automatically
- the job remains visible as active rather than immediately failed
- the Shopping List sidebar shows a retrying status message, for example:
  - `Retrying price check at New World… attempt 2 of 3`
  - `Retrying cart update at New World… attempt 2 of 3`

The user should be able to tell that work is still in progress and not assume the flow has stalled.

### Session expired / logged out

When the New World session is expired:
- the job finishes with a stable machine-readable failure code: `session_expired`
- the Shopping List sidebar shows a specific recovery prompt near the store/actions area
- the prompt explains that New World needs a fresh sign-in on the Mac mini and points the user toward re-running bootstrap + ingest

This message is scoped to the Shopping List page rather than elevated to a global banner.

## Failure model

### Structured error shape

The worker result contract should evolve from plain `error: string` to a structured shape that can still be stored in `scraper_jobs.result` / `scraper_jobs.error` safely.

Recommended logical shape:

```ts
type ScraperErrorCode =
  | 'session_expired'
  | 'rate_limited'
  | 'upstream_unavailable'
  | 'navigation_timeout'
  | 'network_error'
  | 'parser_error'
  | 'invalid_payload'
  | 'no_session'
  | 'unknown';

interface ScraperFailure {
  code: ScraperErrorCode;
  message: string;
  retryable: boolean;
  attempt: number;
  maxAttempts: number;
  phase?: 'compare_prices' | 'add_to_cart' | 'import_past_orders';
}
```

The database can continue to use:
- `scraper_jobs.error` for a summary string
- `scraper_jobs.result` for structured JSON details on both success and failure

This preserves backward simplicity while giving the UI and tests something stable to consume.

### Retryable failures

Retry these conditions:
- network failures while talking to New World
- Playwright navigation timeouts
- upstream HTTP `429`
- upstream `5xx`

Do not retry:
- `session_expired`
- selector/parser drift that indicates site markup changed
- invalid payload / household-ownership failures
- `no_session`

This keeps retries for flaky conditions, not broken invariants.

## Retry policy

- `3` attempts total
- backoff within one claimed job:
  - retry 2 waits `1s`
  - retry 3 waits `3s`

The worker should not release and re-queue the job between attempts. It should keep ownership of the claim, retry inline, and report a final success or failure once attempts are exhausted.

Why inline retries:
- simpler than adding a next-run timestamp or delayed requeue mechanism
- keeps idempotency easier to reason about for `add_to_cart`
- matches the current worker’s single-process polling model

## Architecture

### Worker

Primary touchpoints:
- [apps/scraper/src/index.ts](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/scraper/src/index.ts)
- [apps/scraper/src/stores/newworld.ts](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/scraper/src/stores/newworld.ts)
- [apps/scraper/src/worker-sdk/types.ts](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/scraper/src/worker-sdk/types.ts)

Add a small hardening layer in the worker:
- classify thrown/runtime failures into structured scraper failure codes
- decide whether the failure is retryable
- perform backoff retries inline
- report intermediate retry state only through the eventual job result / server-visible metadata, not through a separate websocket or side channel

The New World adapter should explicitly return structured failures for:
- logged-out session
- invalid payload
- missing session
- parser/site-drift conditions where detectable

### Server

Primary touchpoint:
- [apps/server/src/routes/scraper.ts](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/server/src/routes/scraper.ts)

Server responsibilities:
- accept structured failure details in worker result reporting
- store enough retry/failure metadata for the Shopping List page to display meaningful status
- preserve existing household-ownership checks

This slice does **not** require changing `household_id` semantics or weakening any scoping rule.

### Web UI

Primary touchpoints:
- [apps/web/src/hooks/usePricesForList.ts](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/web/src/hooks/usePricesForList.ts)
- [apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx)
- [apps/web/src/components/AgentStatusCard.tsx](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/web/src/components/AgentStatusCard.tsx)

UI changes stay local to the Shopping List sidebar:
- reuse the existing `AgentStatusCard` for retrying/running/failed language
- extend the store card area with a visible session-expired recovery prompt when needed
- keep the “Find products” and “Send to cart” controls close to the status messaging

No new global notification system is introduced.

## Data contract changes

Shared types in [packages/shared/src/index.ts](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/packages/shared/src/index.ts) should expand so `PricesForListResponse` and `CartResultResponse` can expose structured scraper job details, not just `{ id, status, error }`.

Recommended additive direction:

```ts
interface ScraperJobFailureSummary {
  code: ScraperErrorCode;
  message: string;
  retryable: boolean;
  attempt: number;
  maxAttempts: number;
}

interface ScraperJobSummary {
  id: string;
  status: ScraperJobStatus;
  error: string | null;
  failure: ScraperJobFailureSummary | null;
  retrying: boolean;
}
```

This stays additive and should not require a migration if it is derived from existing row fields plus JSON `result`.

## `launchd` service

Add:
- `apps/scraper/launchd/com.eat-thing.scraper.plist`

Service behavior:
- runs the built scraper worker, not `tsx watch`
- starts automatically on login / load
- restarts on failure
- writes stdout/stderr to predictable log files
- uses the repo working directory and environment expected by the built worker

Production should prefer built JavaScript over a dev command:
- `pnpm --filter @eat/scraper build`
- then run the built entrypoint from `dist/`

This makes the Mac mini service stable and removes the current “planned until plist lands” status.

## Testing strategy

### Unit tests

Scraper-focused:
- retry classification
- retry/backoff behavior
- logged-out failure shape
- idempotent `add_to_cart` behavior preserved under retried transient failures

Likely files:
- `apps/scraper/src/index.test.ts` or a new helper-focused test
- `apps/scraper/src/stores/newworld.test.ts`
- worker-sdk/shared-type tests if added

Server:
- scraper result handling preserves structured failure data
- household-scoped protections remain intact

Web:
- Shopping List shows retry-in-progress messaging
- Shopping List shows session-expired re-login prompt

### E2E

Extend [apps/web/tests/app.spec.ts](/Users/keneselautusi/Documents/Code/PROJECTS/eat-thing/apps/web/tests/app.spec.ts) so mocked scraper job states prove:
- retrying jobs show visible retry messaging
- session-expired failures show the Mac-mini re-login prompt

### Operational verification

Per the backlog roadmap, this slice also needs:
- `pnpm --filter @eat/scraper smoke:newworld`

If that smoke test cannot run because live credentials/session state are unavailable, the implementation can still land, but the slice should be reported as operationally incomplete until that final smoke runs.

## Acceptance criteria

- A logged-out New World session produces a stable machine-readable failure and a visible Shopping List prompt.
- Retryable failures back off and retry with visible user status.
- Permanent failures report immediately without wasting attempts.
- Re-running `add_to_cart` remains idempotent.
- A checked-in `launchd` plist runs the built scraper worker and restarts after failure.
- Mac mini install/reload steps are documented alongside the plist.
- `pnpm test` and `pnpm test:e2e` pass; `pnpm --filter @eat/scraper smoke:newworld` passes when credentials are available.

## Implementation order

Build this slice in this order:

1. Logged-out session detection and Shopping List prompt
2. Transient retry/backoff with visible retrying status
3. Production `launchd` plist and Mac mini install docs

That order yields user value earliest and keeps the ops/config work last.
