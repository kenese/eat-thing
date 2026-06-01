# Decisions

A running log of decisions that shape eat-thing. New decisions append here with date and rationale. Reversals are recorded as new entries that supersede older ones — old entries stay for history.

Each decision: short title, date, context, decision, rationale. Keep it terse — link to [ARCHITECTURE.md](./ARCHITECTURE.md) / [PLAN.md](./PLAN.md) for elaboration.

---

## D1 — OpenBrain is a sync target, not the system of record
**Date:** 2026-05-07
**Context:** Eat-thing needs structured, transactional data (inventory quantities, expiry dates, meal-plan entries). OpenBrain is a thoughts/notes store accessed via MCP.
**Decision:** Eat-thing owns its own database. OpenBrain receives summaries via a sync adapter (`packages/openbrain`).
**Rationale:** Modeling structured food data inside a thoughts store would slow every query and tangle two concerns. A clean adapter also lets us swap the brain later (or support multiple brains for multi-household).

## D2 — Staged delivery: MVP → V2 → V3 → V4
**Date:** 2026-05-07
**Decision:** Build inventory + recipes + meal plan + shopping list (MVP) before recipe ingestion (V2), before read-only supermarket scraping (V3), before build-to-cart (V4).
**Rationale:** MVP is useful on its own. The supermarket integration is the highest-risk piece (bot detection, ToS, scraping fragility) — defer until the rest is proven.

## D3 — Supermarket integration ceiling: build-to-cart
**Date:** 2026-05-07
**Decision:** App will, at most, log in to NW / Pak'nSave / Woolworths and add items to cart. The user always clicks "place order".
**Rationale:** Auto-placing orders crosses into financial-action territory and adds blast-radius risk we don't need. Build-to-cart captures most of the value at a fraction of the risk.

## D4 — Hand-rolled food taxonomy + interactive cook prompts
**Date:** 2026-05-07
**Decision:** `packages/taxonomy` ships a small canonical food list (seeded from the user's first ~50 inventory items) and unit-conversion helpers. Cook events that produce ambiguous quantities prompt the user ("how many garlic bulbs are left?").
**Rationale:** Off-the-shelf taxonomies (USDA, Open Food Facts) carry far more breadth than a household needs. The interactive prompt turns model gaps into data, instead of pretending precision we don't have.

## D5 — Multi-tenant clean now, single household live
**Date:** 2026-05-07
**Decision:** Every domain row carries a `household_id`. Auth attaches the household to the session. Only one household exists at launch; design supports more.
**Rationale:** Retro-fitting tenancy later is painful. The cost up front is one column and one filter clause per query. The OpenBrain sync story for additional households (which won't have one) is parked until a second household is real.

## D6 — Mobile-first PWA
**Date:** 2026-05-07
**Decision:** `apps/web` is a mobile-first PWA (installable, service worker). Native shell deferred indefinitely.
**Rationale:** Photo recipe upload, checking off cooked meals, pulling up the shopping list at the supermarket are all phone tasks. PWA covers them without app-store overhead.

## D7 — Staples manual first, learned later
**Date:** 2026-05-07
**Decision:** MVP: user flags staples and a target threshold. V-later: derive staples + cadence from purchase history.
**Rationale:** Manual list is one form. Trend-learning needs months of purchase data we don't have yet.

## D8 — Database: Supabase (Postgres) + Drizzle
**Date:** 2026-05-07
**Decision:** Hosted Postgres on Supabase. Drizzle as the ORM.
**Rationale:** Two phones, one shared DB. Free tier covers a household. Drizzle is TS-native and lighter than Prisma. Supabase also gives us object storage (recipe photos) without a second vendor.

## D9 — Playwright worker runs on the home Mac mini
**Date:** 2026-05-07
**Decision:** `apps/scraper` runs on the user's always-on Mac mini, talking to the API over the network. Datacenter Playwright is not used.
**Rationale:** Residential IP avoids bot detection on supermarket sites. The Mac mini is already there — no new ops surface.

## D10 — Offline strategy: reads first, writes later
**Date:** 2026-05-07
**Decision:** MVP caches inventory, recipes, shopping list, and meal plan in IndexedDB for offline read. Writes require a connection. Offline write queue is a future task.
**Rationale:** Supermarket-aisle case (no signal, need to check what we have) is real. Offline writes add conflict-resolution complexity we don't need on day one.

## D11 — OpenBrain sync cadence
**Date:** 2026-05-07
**Decision:**
- New recipes → synced to OpenBrain immediately on save.
- Inventory snapshots → nightly.
- Meal plans + cook log → cadence not yet decided; assumed nightly alongside inventory until reviewed.
**Rationale:** Recipes are reference material the user might query Claude about anytime; live sync earns its complexity. Inventory changes too often and is too granular to live-mirror. Meal plans and cook log fall in between — flagged as an open question in PLAN.md.

## D12 — Auth: Better-Auth + Google sign-in
**Date:** 2026-05-07
**Decision:** Better-Auth library, Google OAuth provider, session cookies. No password auth.
**Rationale:** Two known users, both with Google accounts. Better-Auth is TS-native and avoids vendor lock-in (vs Clerk/Auth0).

## D13 — Inventory + meal plan sync: debounced-live, not strictly nightly
**Date:** 2026-05-07
**Supersedes the inventory portion of:** D11
**Decision:** Mutations to inventory and meal plans set a per-resource dirty flag. A debouncer (~5 min after the last change) writes a single snapshot thought per resource to OpenBrain. Cook log keeps the daily roll-up cadence.
**Rationale:** Strictly nightly means stale-by-up-to-24-hours, which makes "ask Claude what's in the fridge" feel broken. Strictly live spams OpenBrain with diff churn (a single cook event can mutate 10+ rows). Debounce gives Claude a near-current view without flooding the brain. Within one request the writes are already one DB transaction → one dirty-flag update; the debounce coalesces across requests too.

## D14 — Mac mini hosts all background workers
**Date:** 2026-05-07
**Decision:** The home Mac mini runs `apps/scraper`, the OpenBrain sync worker, and any future cron (backups, cook-log roll-up). Vercel handles only HTTP.
**Rationale:** Vercel function timeouts and cron limits make long-running background work awkward. The Mac mini is already there, has a residential IP we need anyway for the scraper, and `launchd` supervises it for free. Workers poll the Vercel API outbound for pending jobs, so no inbound port is needed at home.

## D15 — Photo storage: Supabase Storage
**Date:** 2026-05-07
**Decision:** Recipe and inventory photos live in Supabase Storage. Database rows store the storage path; URLs are signed on read.
**Rationale:** Same vendor as the DB — no second auth surface, no second billing relationship. Free tier (1 GB) covers a household's recipe photos comfortably. Vercel Blob and R2 add vendors without solving anything Supabase Storage doesn't.

## D16 — Hosting split: Vercel for HTTP, Mac mini for workers
**Date:** 2026-05-07
**Decision:**
- `apps/web` and `apps/server` deployed to Vercel.
- `apps/scraper` and the OpenBrain sync worker run on the home Mac mini, supervised by `launchd`.
- Workers communicate with the API via outbound HTTPS polling for pending jobs.
**Rationale:** Splitting the frontend/API from background work means the app stays available when the Mac mini is down (no fresh OpenBrain syncs, but reads/writes still work). Polling avoids exposing a port at home. If poll chatter ever feels excessive, swap in SSE later — the polling-vs-push detail is hidden behind the worker SDK.

## D18 — OpenBrain bulk recipe import: single household account, per-user deferred
**Date:** 2026-05-11
**Context:** User wants to import recipes already stored in OpenBrain into eat-thing. D1 established OpenBrain as a sync target (eat-thing → OpenBrain). Reading back from OpenBrain for a one-off import is a different concern — migration, not ongoing app logic.
**Decision:** The import feature reads from the single OpenBrain account configured on the Mac mini (same account the sync worker already writes to). Per-user OpenBrain accounts are not supported yet.
**Rationale:** Supporting per-user accounts requires storing an API key per user in the DB, creating per-request MCP client instances, and adding a key-management UI — meaningful work with no current demand (two-user household, one OpenBrain account). The single-account implementation re-uses the existing singleton client. Per-user support is a named follow-up; a `// TODO(per-user-openbrain)` comment marks the extension point.

## D17 — Supermarket session encryption key lives on the Mac mini only
**Date:** 2026-05-10
**Context:** PLAN.md and ARCHITECTURE.md disagreed on where the AES key for `supermarket_credentials.encrypted_session_blob` lives. Need a single home that the bootstrap and worker scripts can read.
**Decision:** The key (`SUPERMARKET_ENC_KEY`, 32 bytes base64) lives only on the Mac mini. The server stores ciphertext as opaque bytes and never decrypts. Bootstrap is split: a headed login script runs on the user's laptop and writes plaintext `storageState` to disk; the user transfers the file to the mini; an ingest script on the mini encrypts and POSTs.
**Rationale:** A server compromise should not leak supermarket sessions, since they're not data the server's HTTP surface ever needs. Two-step bootstrap keeps the key off any other machine. Rotation cost is one re-bootstrap per store — acceptable for a two-user household.

## D19 — Meal Planner imports use a dedicated adapter
**Date:** 2026-05-13
**Context:** Meal Planner is part of the OpenBrain ecosystem, but it is exposed as its own MCP server with structured recipe tools. Routing structured Meal Planner imports through the OpenBrain thoughts adapter would blur two different integration boundaries.
**Decision:** Meal Planner recipe imports use a dedicated `@eat/meal-planning` package. The OpenBrain package remains responsible for thought search/fetch/sync only.
**Rationale:** The adapter boundary matches the MCP boundary, keeps recipe import code from depending on thought-store transport, and preserves the original rule that OpenBrain is not the runtime source of truth for eat-thing.

## D21 — Narrow MVP supermarket scope to New World only
**Date:** 2026-05-15
**Context:** Pak'nSave and Woolworths adapters exist in `apps/scraper` (parsers, fixtures, bootstrap, smoke scripts). Running all three in parallel adds bootstrap ops burden and design complexity (multi-store UI, fan-out, price comparison) before any store is proven stable in production.
**Decision:** MVP ships New World only — prices, availability, and build-to-cart. Pak'nSave and Woolworths are deferred to post-MVP (see IDEAS.md). The adapter code stays in `apps/scraper` but the bootstrap and smoke for those stores won't be wired in until after Phase 4.
**Rationale:** One store working well beats three stores half-working. Price comparison and split-shop optimisation only make sense once the single-store flow is solid.

## D20 — OpenBrain ecosystem recipe imports prefer Meal Planner structured data
**Date:** 2026-05-13
**Context:** The existing OpenBrain bulk import reads recipe thoughts and parses prose/markdown, but Meal Planner is part of the OpenBrain ecosystem and stores recipes with structured fields.
**Decision:** New OpenBrain ecosystem recipe imports read from Meal Planner first. OpenBrain recipe-thought import remains as a legacy fallback for old notes.
**Rationale:** Structured Meal Planner payloads reduce LLM parsing, preserve quantities/servings more reliably, and still satisfy the intent of importing from the OpenBrain ecosystem. Eat-thing remains the source of truth after import.

## D22 — Remove OpenBrain sync integration (2026-05-16)

Removed the full OpenBrain sync integration: `packages/openbrain`, the `sync_dirty` table,
`/api/sync` routes, `openbrain-worker`, the `synced` column on `inventory_items`, the OpenBrain
import tab in the ImportModal, and all associated server-side sync fire-and-forgets.

**Why:** OpenBrain is no longer the integration target. The Meal Planner integration (via MCP)
replaces it as the recipe source, and we have no need for inventory/meal-plan push sync to
an external brain store. Removing dead code simplifies the codebase and eliminates a launchd
worker that wasn't running.

**What's kept:** Meal Planner import (MCP), URL import, photo import, MealDB search.

## D23 — Phase 4 build-to-cart implementation: top-N candidates + per-item review + diff-style cart writes
**Date:** 2026-05-18
**Decision:**
- Reshape `compare_prices` to return top-N (default 5) `ProductCandidate[]` per item, ranked by per-100g/ml unit price among packs that meet the recipe's required qty (multiplier ≥ 1 when no single pack is big enough). Three resolutions: `sole` (one viable candidate), `preferred` (preferred brand wins in top 3), `manual` (multiple plausible, no preferred). Specials are decoration, not ranking.
- Persist candidates + chosenSku on `shopping_list_prices` (already per-item, per-store) — not on `shopping_list_items` — so multi-store cart builds later inherit the shape cleanly.
- Two-job pipeline: `compare_prices` → user reviews and (for manual items) picks → `add_to_cart`. The one-button collapsed UX (Approach B in the spec) is deferred; it builds on the same primitives.
- `add_to_cart` diffs against the live trolley before writing → idempotent under retry, safe to re-run.
- Detailed result JSON on `scraper_jobs` (no new audit table). Reconcile view reads it back via a dedicated endpoint.

**Rationale:** Two-job pipeline is the simplest debuggable shape; each job has its own row + result JSON, and the user can resume work between steps. Per-100g/ml ranking matches how the user actually buys (cheapest per unit volume / weight, given a pack big enough to cover the recipe). Diff-against-trolley turns retries into no-ops, the safest property for a write that crosses an external service.

## D24 — Architecture-audit correction: explicit tenant filters and one scraper HMAC secret
**Date:** 2026-06-01
**Context:** The architecture audit found shopping-list price/cart handlers that accepted a list UUID without first proving list ownership, and `shopping_list_prices` lacked its own `household_id`. The scraper server middleware and worker SDK also used different environment-variable names for the same HMAC secret.
**Decision:** Household-scoped domain tables, including `shopping_list_prices`, carry `household_id`. Shopping-list price/cart handlers check list ownership and filter touched rows directly by the authenticated household. `canonical_foods` remains a global curated reference table; Better-Auth-owned tables remain auth-library exceptions. Scraper request signing uses `SCRAPER_HMAC_SECRET` everywhere.
**Rationale:** UUIDs and indirect joins are not tenancy boundaries. A tenant column plus direct predicates makes isolation reviewable at each query. One environment-variable name prevents the server and Mac-mini worker from silently signing with different secrets.

## D25 — Architecture-audit alignment: canonical inventory units, shared low-stock staples, and documentation truthfulness
**Date:** 2026-06-02
**Context:** The follow-on audit slices found product/documentation drift around inventory units, low-stock staples, recipe metadata, and the still-pending taxonomy-review + scraper-ops work.
**Decision:** Inventory storage units are restricted to canonical `g`, `ml`, or `count`; low-stock staples are derived once on the server and reused by shopping-list generation and the Inventory sidebar; recipe writes/imports preserve original ingredient qty/unit text while also persisting normalized metric annotations plus `total_time_minutes` and `tags`. Docs now describe mutable inventory balances, append-only cooking audit events, public recipe-photo URLs, Meal Planner HTTP MCP with stdio fallback, single-household-first middleware behavior, and `launchd` supervision as planned until the scraper plist lands.
**Rationale:** These choices keep the runtime model consistent across routes and UI surfaces, reduce drift between import/display/calculation paths, and make the docs a reliable map of what is shipped versus what is merely planned.

## D26 — Canonical foods require explicit server-enforced taxonomy review
**Date:** 2026-06-02
**Context:** Inventory add and manual shopping-list add were still able to silently create rows in the global `canonical_foods` table. That contradicted the curated-taxonomy rule and made it too easy for alternate clients or future routes to bypass review.
**Decision:** Server call sites that previously used silent `findOrCreateFood` now use a "find existing or require review" flow. Strong existing matches are reused; otherwise the server returns a typed `taxonomy_review_required` response and the client must either pick an existing canonical food or explicitly confirm creation via `POST /api/foods`.
**Rationale:** Making taxonomy review a server invariant keeps the global reference table curated across all clients, not just the current web UI. Returning a structured stop instead of silently inserting keeps the UX lightweight while preserving a clean, reviewable taxonomy.
