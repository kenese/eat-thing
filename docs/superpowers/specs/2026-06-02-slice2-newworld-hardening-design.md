# Slice 2 - New World Hardening Design

**Date:** 2026-06-02

## Goal

Make the New World scraper reliable in ordinary operation: show a specific
Mac-mini re-login prompt for expired sessions, retry brief upstream failures
without creating duplicate queue jobs, expose retry progress in the Shopping
List UI, and supervise the production worker with `launchd`.

## Scope

This remains New World-first. It hardens the existing `compare_prices` and
`add_to_cart` jobs without adding multi-store orchestration, delivery windows,
or a new shopping-list model.

## Runtime Design

The worker classifies failures with stable error codes. It retries `429`,
upstream `5xx`, Playwright navigation timeouts, and network failures inline for
up to three attempts. Retry 2 waits one second; retry 3 waits three seconds.
`session_expired`, parser drift, invalid payloads, missing sessions, and unknown
failures do not retry.

Before each retry sleep, the worker posts structured failure metadata to
`POST /api/scraper/jobs/:id/progress`. The HMAC-protected endpoint stores the
metadata in the existing `scraper_jobs.result` JSON while the job remains
`in_progress`. This gives the Shopping List UI a visible attempt count without
a schema migration or delayed requeue mechanism.

Final failures use the same structured metadata in `scraper_jobs.result` and
retain a concise code in `scraper_jobs.error`. Expired sessions render an
inline prompt near the New World actions instructing the user to run bootstrap
and ingest again.

## Operations

`apps/scraper/launchd/com.eat-thing.scraper.plist` runs the compiled worker from
`apps/scraper/dist/index.js`, restarts it through `launchd`, and sends logs to
`~/Library/Logs`. Secrets stay in ignored `apps/scraper/.env`; they are not
embedded in the plist.

## Verification

- Vitest covers classification, backoff, progress reporting, server storage,
  job-summary mapping, and Shopping List rendering.
- Playwright E2E covers the expired-session prompt and retrying price state.
- `plutil -lint`, scraper build, the live New World search smoke, `pnpm test`,
  and `pnpm test:e2e` are required gates.
