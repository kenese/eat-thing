# Slice 2 New World Hardening Implementation Plan

**Date:** 2026-06-02

**Goal:** Land the New World reliability hardening described in
`docs/superpowers/specs/2026-06-02-slice2-newworld-hardening-design.md`.

## Tasks

- [x] Add shared scraper failure codes and structured job summaries.
- [x] Add TDD coverage for session-expired and retrying Shopping List states.
- [x] Add worker retry classification and bounded `1s` / `3s` inline backoff.
- [x] Add HMAC-protected `POST /api/scraper/jobs/:id/progress`.
- [x] Store retry metadata in existing `scraper_jobs.result` JSON while status
  remains `in_progress`.
- [x] Expose retry progress and expired-session recovery copy in the Shopping
  List sidebar for price and cart jobs.
- [x] Classify New World `429` and upstream `5xx` responses for retry.
- [x] Add the production Mac-mini `launchd` plist and install notes.
- [x] Refresh architecture docs, agent guidance, D27, and `PLAN.md`.

## Verification

- [x] Focused web, scraper, and server Vitest suites.
- [x] Focused Shopping List Playwright tests.
- [x] `plutil -lint apps/scraper/launchd/com.eat-thing.scraper.plist`.
- [x] `pnpm --filter @eat/scraper build`.
- [x] `pnpm --filter @eat/scraper smoke:newworld`.
- [x] `pnpm test`.
- [x] `pnpm test:e2e`.
