# Handoff Backlog Execution Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:brainstorming` before designing any gated slice, then use `superpowers:writing-plans` to create an implementation plan for that slice. Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` only after the slice plan is approved.

**Goal:** Turn the remaining `TODO.md`, `HANDOFF-LANDED.md`, and Phase 3 hardening items into an ordered delivery sequence.

**Architecture:** The remaining work is not one feature. It is split into independently shippable slices so each slice has a focused design, implementation plan, migration strategy where needed, and full-suite verification. Existing household scoping rules remain mandatory for every server query and migration.

**Tech Stack:** React 19, TanStack Query, Express, Drizzle/Postgres, Playwright scraper worker, `launchd`, Vitest, Playwright E2E.

---

## Already complete

- [x] Apply `0009_recipe_time_tags.sql` to production.
- [x] Update `apps/server/package.json` so `pnpm --filter @eat/server db:migrate` uses the reachable Supabase pooler through `apps/server/scripts/migrate.mjs`.

## Delivery order

| Order | Slice | Status | Depends on |
|---|---|---|---|
| 1 | Inventory low-stock staples widget | Ready to plan and execute | Existing `useStaples()` hook |
| 2 | Scraper session-expiry handling, retry/backoff, and Mac-mini `launchd` service | Needs focused design, then plan | Existing New World worker |
| 3 | Shared meal-plan date picker | Needs UX design, then plan | Existing rolling 17-day plan |
| 4 | Shopping-list scheduling | Needs product/data-model design, then plan | Slice 3 date-picker interaction pattern |
| 5 | Plan auto-shop preview | Needs UX/API design, then plan | Slice 4 scheduled shopping list |
| 6 | Delivery-window picker | Deferred pending store API research | Slice 5 preview surface and New World slot API |
| 7 | `/shops` route | Needs product-scope design, then plan | Stable New World operational flow from Slice 2 |

## Decisions, not implementation tasks

### Inventory location model

Keep the current category-derived fridge/pantry/freezer counts for now. Migration `0006_drop_inventory_location.sql` deliberately removed `inventory_items.location`; adding it back would reverse a prior product change and require an explicit new entry in `DECISIONS.md`.

Revisit only when the derived mapping causes a real user-visible problem, such as pantry produce or freezer meat being materially misrepresented.

### Mobile breakpoint

Keep the bottom tab bar at `<=768px` until a tablet visual review demonstrates a layout issue. Treat this as a spot-check during Slice 1 verification, not as a standalone feature.

---

## Slice 1: Inventory low-stock staples widget

**Why first:** The API and frontend hook already exist. This closes a visible stub without schema work.

**Scope:**
- Use `useStaples()` in `apps/web/src/pages/InventoryPage/InventoryPage.tsx`.
- Compute on-hand quantities from the currently loaded inventory rows by `canonicalFoodId`.
- Render only staples whose on-hand quantity is below `thresholdQty` when units match.
- For mismatched units, render the staple as needing review rather than silently comparing incompatible values.
- Replace the current `staple tracking coming soon.` placeholder.

**Files expected to change:**
- `apps/web/src/pages/InventoryPage/InventoryPage.tsx`
- `apps/web/src/pages/InventoryPage/InventoryPage.css`
- Add or extend an Inventory page component test.
- Extend `apps/web/tests/app.spec.ts` with a low-staples sidebar assertion.

**Acceptance criteria:**
- A staple below threshold appears with its current and target quantity.
- A staple at or above threshold does not appear.
- Loading, empty, and incompatible-unit states are explicit.
- `pnpm test` and `pnpm test:e2e` pass.

---

## Slice 2: New World scraper hardening and Mac-mini service

**Why second:** The shopping-list and build-to-cart flows depend on the scraper being operationally reliable before more store-facing UI is added.

**Design questions to answer before implementation:**
- Which failures are retryable: network timeout, HTTP `429`, upstream `5xx`, page navigation timeout, and selector miss?
- How many attempts and what backoff schedule should run inside one job?
- How should a logged-out result be represented in `scraper_jobs.result`, and where should the web UI display the re-bootstrap prompt?
- Should the `launchd` plist run built JavaScript via `pnpm start` or TypeScript via `pnpm dev:scraper`? Production should prefer built JavaScript.

**Expected implementation areas:**
- `apps/scraper/src/index.ts`
- `apps/scraper/src/stores/newworld.ts`
- `apps/scraper/src/worker-sdk/types.ts`
- `apps/server/src/routes/scraper.ts`
- Shopping-list scraper-status UI
- New `apps/scraper/launchd/com.eat-thing.scraper.plist`
- Unit tests for retry classification, backoff, and logged-out results
- E2E assertion for the re-bootstrap prompt

**Acceptance criteria:**
- A logged-out New World session produces a stable machine-readable failure and a visible user prompt.
- Retryable failures back off and retry; permanent failures report immediately.
- Re-running `add_to_cart` remains idempotent.
- The checked-in plist starts the built scraper worker and restarts it after failure.
- Installation steps for the Mac mini are documented.
- `pnpm test`, `pnpm test:e2e`, and a New World smoke test pass.

---

## Slice 3: Shared meal-plan date picker

**Why third:** Both Plan `load date` and Recipes hero `add to <day>` need the same date-selection interaction. Design and build one reusable component.

**Design direction to validate:**
- Use a compact modal mini-calendar rather than a raw inline date input.
- Plan page calendar selects a date and scrolls the rolling rail to that day.
- Recipes hero opens the same picker, defaults to the next open day, and adds the featured recipe to the selected date.

**Expected implementation areas:**
- New shared date-picker component under `apps/web/src/components/`
- `apps/web/src/pages/PlanPage/PlanPage.tsx`
- `apps/web/src/pages/RecipesPage/RecipesPage.tsx`
- Component tests for selection, cancel, and default date
- E2E tests for load-date scrolling and adding a hero recipe to a chosen day

**Acceptance criteria:**
- The disabled Plan calendar stub is removed.
- Selecting a date scrolls the plan rail to that date.
- Recipes hero CTA names or opens a meaningful selected day rather than using `add to next open day`.
- Existing add-to-next-empty-days behavior remains available where appropriate.
- `pnpm test` and `pnpm test:e2e` pass.

---

## Slice 4: Shopping-list scheduling

**Why fourth:** Dynamic Recipes quick-shop copy and later delivery selection both need an explicit shopping-list date.

**Design questions to answer before implementation:**
- Is the field `scheduled_for` a date or timestamp? Prefer a household-local date until delivery slots introduce times.
- Does each household have one active list or multiple upcoming lists?
- Where does the user edit the scheduled date?

**Expected implementation areas:**
- New `shopping_lists.scheduled_for` migration and Drizzle schema field
- Shared `ShoppingList` type update
- Household-scoped shopping-list routes
- Shopping-list UI date control
- Recipes quick-shop hint using the scheduled date
- Server, component, and E2E tests
- New numbered `DECISIONS.md` entry

**Acceptance criteria:**
- An active shopping list stores and returns a household-scoped scheduled date.
- The Recipes quick-shop hint renders that date when present and keeps a generic fallback otherwise.
- `pnpm --filter @eat/server db:migrate`, `pnpm test`, and `pnpm test:e2e` pass.

---

## Slice 5: Plan auto-shop preview

**Why fifth:** This preview should read from the scheduled-list model rather than inventing a parallel concept.

**Design questions to answer before implementation:**
- Should preview calculations mutate the shopping list or remain read-only until confirmation? Prefer read-only preview.
- Which totals are shown before a compare-prices scraper job exists?
- Does confirmation navigate to `/list` or update the current list in place?

**Expected implementation areas:**
- Household-scoped server pre-flight endpoint derived from planned recipes and inventory
- TanStack Query hook
- Plan page preview panel
- Server, component, and E2E tests

**Acceptance criteria:**
- Previewing does not mutate the shopping list.
- Confirming uses the existing add-from-plan path or a deliberately documented replacement.
- Empty, loading, and error states are explicit.
- `pnpm test` and `pnpm test:e2e` pass.

---

## Slice 6: Delivery-window picker

**Why later:** The current repository has no delivery-slot model and no confirmed New World delivery-slot API. This is a research-backed integration feature, not a cosmetic grid.

**Research gate:**
- Inspect New World checkout traffic in a headed Playwright session.
- Document slot identifiers, availability semantics, expiry behavior, and whether selection mutates the trolley or checkout session.
- Confirm the integration stays below the D3 ceiling: the user still places the order.

**Acceptance criteria for planning readiness:**
- Slot API behavior is documented with captured examples.
- A proposed schema and scraper job contract exist.
- UX distinguishes unavailable, expired, and selected slots.
- A new numbered `DECISIONS.md` entry records the approach.

---

## Slice 7: `/shops` route

**Why last:** The route should reflect a stable store workflow. Building it before scraper hardening and delivery-window research risks a decorative page with no coherent job.

**Design questions to answer before implementation:**
- Is `/shops` an operational status page, a New World account/settings page, or a future multi-store comparison page?
- Which actions belong there instead of on the shopping-list page?
- What does the disabled nav item become on mobile, where there is no shops tab?

**Acceptance criteria for planning readiness:**
- Route purpose, information hierarchy, and mobile entry point are approved.
- New World-only MVP scope from D21 is preserved.
- Pak'nSave and Woolworths remain deferred until explicitly reactivated.

---

## Verification rule for every executed slice

Before marking a slice complete in `PLAN.md`:

```bash
pnpm test
pnpm test:e2e
```

For scraper changes also run:

```bash
pnpm --filter @eat/scraper test
pnpm --filter @eat/scraper smoke:newworld
```

If an environment-dependent smoke test cannot run, record the exact reason and do not claim the slice is fully complete.
