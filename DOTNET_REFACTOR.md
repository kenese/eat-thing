# .NET Backend Refactor Guidance Plan

> **Intent:** The owner of this repo intends to manually rebuild the backend server in C#/.NET as a learning exercise. Agents should guide the work step by step, explain the .NET concepts involved, review the owner's code, and help debug, but should not take over the conversion unless explicitly asked.

**Goal:** Replace the current `apps/server` Express/Drizzle API with an idiomatic ASP.NET Core backend while preserving the existing React PWA, Postgres data model, household tenancy rules, scraper-worker contract, and product behavior.

**Recommended Architecture:** Build a modular monolith first. Use vertical slices and CQRS-style command/query handlers inside one ASP.NET Core deployable. Treat microservices as a future extraction option after module boundaries and scaling pressures are proven.

**Learning Goal:** Learn practical .NET backend development through the real app: ASP.NET Core routing, dependency injection, EF Core/Postgres, validation, integration testing, auth/tenancy middleware, background job contracts, and production deployment.

---

## How Agents Should Use This Plan

The human developer is doing the conversion manually.

Agents should:

- Explain each step before asking the human to implement it.
- Keep tasks small enough to complete and verify in one sitting.
- Prefer teaching over generating large code drops.
- Review diffs, tests, API contracts, and architectural decisions.
- Preserve existing behavior unless the human explicitly chooses a product change.
- Call out .NET idioms and tradeoffs when translating TypeScript patterns.
- Ask before changing files, scaffolding projects, or replacing implementation.

Agents should not:

- Convert whole modules automatically unless asked.
- Skip tests because this is a learning exercise.
- Introduce microservices, event sourcing, or extra infrastructure before the modular monolith is working.
- Change frontend behavior unless the current API contract cannot reasonably be preserved.
- Silently weaken household scoping or taxonomy-review rules.

Suggested prompt for future sessions:

```text
Use DOTNET_REFACTOR.md. I am manually converting the backend to .NET.
Guide me through the next unchecked step. Explain what I am doing, wait for me
to make the change, then review/debug it with me.
```

---

## Architectural Position

### Start With A Modular Monolith

The first .NET backend should be one ASP.NET Core application, probably under:

```text
apps/dotnet-server/
```

It should be internally modular:

```text
apps/dotnet-server/
  src/
    EatThing.Api/
    EatThing.Modules/
      IdentityTenancy/
      Taxonomy/
      Inventory/
      Recipes/
      MealPlanning/
      ShoppingLists/
      Supermarkets/
    EatThing.Infrastructure/
    EatThing.Shared/
  tests/
    EatThing.Api.Tests/
    EatThing.IntegrationTests/
```

Do not split into separate deployable services at the start. The current app has several workflows that cross domain boundaries:

- Cooking a meal touches meal-plan entries, inventory balances, and append-only cook events.
- Shopping-list generation reads recipes, recipe ingredients, inventory, staples, and manual list rows.
- Supermarket jobs depend on shopping-list state and the Mac-mini worker contract.
- Taxonomy is global and curated, while most runtime data is household-scoped.

Those interactions are much easier to learn and preserve inside one process first.

### Use CQRS Internally

Use command/query separation in code, not separate databases initially.

Good examples:

- `FindExistingFoodOrRequireReviewQuery`
- `ConfirmCanonicalFoodCommand`
- `AddInventoryItemCommand`
- `GenerateShoppingListFromPlanCommand`
- `PreviewShoppingListFromPlanQuery`
- `MarkMealCookedCommand`
- `ComparePricesCommand`
- `CompleteScraperJobCommand`

Each slice should contain:

- HTTP endpoint mapping
- Request/response DTOs
- Validator
- Handler
- Tests

Avoid a large generic service layer where every domain rule becomes `FoodService.DoThing()`.

### Keep Microservices As A Future Option

Future service boundaries, if scale and team size justify them:

- Identity/Tenancy
- Taxonomy/Catalog
- Inventory
- Recipes
- Meal Planning
- Shopping Lists
- Supermarket Integration / Jobs

Before extracting any service, require:

- Clear ownership by a team.
- Stable API contract.
- Independent scaling need.
- Independent deployment need.
- Observability in place.
- A plan for eventual consistency and retries.

For now, module boundaries should be clean enough that extraction is possible later, but not paid for upfront.

---

## Non-Negotiable Domain Rules

Preserve these from `AGENTS.md`, `ARCHITECTURE.md`, and `DECISIONS.md`:

- Every household-scoped query filters directly by `household_id`.
- `canonical_foods` is global and curated.
- Inventory and manual shopping-list flows must not silently create canonical foods.
- New food creation must go through explicit taxonomy review.
- Inventory is stored as mutable balance rows.
- `cook_events` are append-only audit records.
- Storage units are canonical: `g`, `ml`, `count`.
- Recipe ingredient original text is preserved; metric values are annotations.
- Meal Planner import remains an adapter only; eat-thing remains the source of truth.
- Supermarket integration may build carts but must not place orders.
- Mac-mini scraper jobs are polled outbound; no inbound home port.

---

## Recommended .NET Stack

Choose exact versions at kickoff based on the installed SDK and current LTS, but the shape should be:

- ASP.NET Core Web API
- EF Core with Npgsql for Postgres
- FluentValidation or endpoint-local validation
- xUnit or NUnit for unit/integration tests
- Testcontainers for Postgres integration tests
- OpenAPI/Swagger in development
- Problem Details for consistent API errors
- OpenTelemetry for traces/logs/metrics once the first slices work

Decision to make early:

- Use explicit handler classes first.
- Add MediatR only if the handler wiring becomes noisy.

For learning, explicit handlers are better because the flow is visible.

---

## Conversion Strategy

Use a strangler approach.

1. Keep the existing TypeScript server working.
2. Add the .NET server side-by-side.
3. Port one bounded API slice at a time.
4. Point the frontend or tests at the .NET endpoint only after that slice passes.
5. Preserve API responses unless a deliberate contract change is documented.
6. Delete the old TypeScript route only after the .NET replacement is verified.

Do not attempt a big-bang rewrite.

---

## Phase 0: Learning And Groundwork

- [x] Install or confirm the local .NET SDK.

  Run:

  ```bash
  dotnet --info
  ```

  Agent guidance:

  - Explain SDK vs runtime.
  - Confirm whether the installed SDK is suitable.
  - Avoid changing repo files in this step.

- [x] Create a small scratch ASP.NET Core API outside the repo or in a disposable folder.

  Purpose:

  - Learn controllers/minimal APIs.
  - Learn dependency injection.
  - Learn configuration.
  - Learn `dotnet test`.

  Agent guidance:

  - Keep this separate from eat-thing.
  - Do not introduce architecture yet.

- [x] Read the current backend shape.

  Files to inspect:

  ```text
  apps/server/src/
  apps/server/src/db/schema/
  apps/server/src/routes/
  apps/server/src/lib/find-or-create-food.ts
  ARCHITECTURE.md
  DECISIONS.md
  ```

  Agent guidance:

  - Map current Express concepts to ASP.NET Core equivalents.
  - Identify one first slice before scaffolding.

---

## Phase 1: Scaffold The .NET Server

- [x] Create `apps/dotnet-server`.

  Status:

  - `apps/dotnet-server/EatThing.slnx` exists.
  - `src/EatThing.Api/EatThing.Api.csproj` exists.
  - `tests/EatThing.Api.Tests/EatThing.Api.Tests.csproj` exists.
  - The eat-thing health endpoint exists.

  Target responsibilities:

  - ASP.NET Core entrypoint.
  - Configuration loading.
  - Test project.

- [x] Add the first eat-thing endpoint: `GET /healthz`.

  Expected first endpoint:

  ```http
  GET /healthz
  ```

  Expected response:

  ```json
  { "status": "ok" }
  ```

- [x] Add repo scripts without replacing the TypeScript server.

  Candidate root scripts:

  ```json
  {
    "dev:dotnet": "dotnet watch --project apps/dotnet-server/src/EatThing.Api",
    "test:dotnet": "dotnet test apps/dotnet-server"
  }
  ```

  Agent guidance:

  - Check existing `package.json` scripts first.
  - Avoid breaking `pnpm dev`, `pnpm test`, or `pnpm test:e2e`.

- [x] Add a first test for `/healthz`.

  Learning goal:

  - Understand ASP.NET Core integration testing.
  - Understand the test host.

  Done when:

  - `dotnet test apps/dotnet-server` passes.
  - Existing TypeScript tests are unaffected.

---

## Phase 2: Database Connectivity

- [x] Connect to the existing Postgres database read-only first.

  Learning goal:

  - EF Core DbContext.
  - Connection strings.
  - Environment-specific configuration.

  Constraint:

  - Do not create migrations yet.
  - Do not write data yet.

- [x] Model only the first required tables.

  Start with:

  ```text
  canonical_foods
  ```

  Avoid modeling the whole database upfront.

- [ ] Add a read-only endpoint for canonical food search.

  Candidate endpoint:

  ```http
  GET /api/foods/search?q=tomato
  ```

  Done when:

  - The .NET endpoint returns the same shape as the current TypeScript endpoint where practical.
  - Integration tests run against a test Postgres.

---

## Phase 3: First Real Slice — Taxonomy Review

Port the behavior represented by:

```text
apps/server/src/lib/find-or-create-food.ts
```

Current TypeScript behavior:

- Trim the proposed food name.
- Search `canonical_foods` with a case-insensitive partial match.
- If an exact case-insensitive match exists, return `existing`.
- Otherwise return `review` with the proposed food and up to five candidate matches.

.NET slice:

```text
Taxonomy/
  FindExistingFoodOrRequireReview/
    Endpoint
    Request
    Response
    Handler
    Validator
    Tests
```

- [ ] Write tests for exact match, partial matches, and no match.

- [ ] Implement `FindExistingFoodOrRequireReviewQuery`.

- [ ] Implement typed response variants:

  ```text
  existing
  review
  ```

- [ ] Confirm the API behavior matches the frontend expectations.

Done when:

- Taxonomy review behavior works in .NET.
- Tests cover exact match and review-required paths.
- No code path silently creates `canonical_foods`.

This is the first useful learning checkpoint.

---

## Phase 4: Auth And Household Tenancy

This is a major design point. Do it before porting write-heavy household data.

- [ ] Decide how the .NET API will authenticate during the transition.

  Options:

  1. Preserve the existing TypeScript auth server temporarily and forward authenticated requests.
  2. Reimplement auth in .NET.
  3. Use development-only auth while porting, then solve production auth before switching traffic.

  Recommendation:

  - Use development-only auth only for early local slices.
  - Before porting inventory writes, implement real household resolution.

- [ ] Implement request household context.

  Required behavior:

  - Every household-scoped handler receives a resolved `HouseholdId`.
  - Handlers cannot run without it.
  - Queries filter directly on `household_id`.

- [ ] Add tests that prove cross-household data is not returned.

  Done when:

  - A handler cannot accidentally query by row id alone.
  - Tests fail if `household_id` filtering is removed.

---

## Phase 5: Inventory

Port inventory after taxonomy and tenancy are understood.

Slices:

- [ ] List inventory items.
- [ ] Add inventory item using existing canonical food.
- [ ] Add inventory item with taxonomy-review-required response.
- [ ] Edit inventory item.
- [ ] Delete inventory item.

Rules to preserve:

- Inventory rows are mutable balances.
- Units are only `g`, `ml`, `count`.
- Every query filters by `household_id`.
- Free-text new foods must route through taxonomy review.

Done when:

- Frontend inventory flows can use .NET endpoints locally.
- Unit and integration tests cover tenant isolation and taxonomy review.

---

## Phase 6: Recipes

Slices:

- [ ] Recipe list.
- [ ] Recipe detail.
- [ ] Manual recipe create/update.
- [ ] Recipe ingredient persistence.
- [ ] Recipe delete.

Rules to preserve:

- Preserve original ingredient quantity/unit text.
- Preserve optional metric annotations.
- Store `total_time_minutes` and `tags`.
- Keep ingredient-to-canonical-food mapping explicit.

Do not port URL/photo/Meal Planner ingestion first. Manual CRUD is the base.

---

## Phase 7: Meal Planning

Slices:

- [ ] List plan entries for date range.
- [ ] Add recipe to date.
- [ ] Update servings/status.
- [ ] Remove entry.
- [ ] Enforce max four recipes per day on the server.

Rules to preserve:

- Plan entries are date-keyed directly.
- No resurrected `meal_plans` week table.
- Every route is household-scoped.

---

## Phase 8: Shopping Lists

This is one of the most important domain areas. Port only after inventory, recipes, and meal planning are stable.

Slices:

- [ ] Read current shopping list.
- [ ] Add manual item.
- [ ] Preserve manual items while refreshing derived rows.
- [ ] Preview shopping list from plan.
- [ ] Generate shopping list from plan.
- [ ] Mark item purchased.
- [ ] Batch delete.
- [ ] Scheduled shopping date.

Rules to preserve:

- Derived list = recipe gaps minus inventory plus low-stock staples.
- Manual rows survive refresh.
- Recipe/staple-derived rows can be regenerated.
- New manual foods require taxonomy review.
- Scheduled date is a household-local `YYYY-MM-DD`, not a timestamp.

Done when:

- Existing shopping-list Playwright flows pass against the .NET backend.

---

## Phase 9: Cook Events

Slices:

- [ ] Mark meal cooked.
- [ ] Deduct inventory balances.
- [ ] Record append-only cook event.
- [ ] Preserve prompt-resolved deductions.

Rules to preserve:

- Do not edit historical cook events.
- Use a transaction for inventory deductions plus cook event creation.
- Validate all touched inventory rows belong to the active household.

This slice is a good place to discuss domain events inside the modular monolith.

---

## Phase 10: Supermarket Job Contract

Port this late because it involves the Mac-mini worker and external side effects.

Slices:

- [ ] Job enqueue endpoints.
- [ ] Worker claim endpoint.
- [ ] Worker progress endpoint.
- [ ] Worker result endpoint.
- [ ] Price snapshot reads.
- [ ] Add-to-cart job result reads.

Rules to preserve:

- Worker uses outbound polling.
- HMAC signing uses one shared `SCRAPER_HMAC_SECRET`.
- Server never decrypts supermarket session blobs.
- Logged-out sessions surface as actionable UI state.
- Build-to-cart is allowed; placing orders is not.
- Job result handling must be idempotent where retries are possible.

Done when:

- Existing scraper worker can talk to the .NET API in local smoke tests.

---

## Phase 11: Ingestion Integrations

Port ingestion after core CRUD is stable.

Slices:

- [ ] URL recipe import.
- [ ] Photo recipe import.
- [ ] TheMealDB search import.
- [ ] Meal Planner MCP import.

Rules to preserve:

- Imported recipes go through edit-and-confirm.
- Low-confidence food matches are explicit.
- Meal Planner remains an adapter only.
- Eat-thing remains the source of truth after import.

---

## Phase 12: Production Cutover

- [ ] Add deployment target for the .NET API.

- [ ] Decide routing:

  ```text
  /api/* -> .NET server
  ```

  or staged:

  ```text
  /api/dotnet/* -> .NET server during migration
  ```

- [ ] Run full verification:

  ```bash
  pnpm test
  pnpm test:e2e
  dotnet test apps/dotnet-server
  ```

- [ ] Confirm scraper smoke tests.

- [ ] Remove or archive replaced TypeScript server routes only after parity is proven.

---

## Future Scale Notes

### More Developers

The modular monolith should support multiple developers by assigning ownership by module:

- Taxonomy team
- Inventory/recipes team
- Meal planning/shopping-list team
- Supermarket integration team
- Platform/auth/observability team

Use module boundaries, tests, and code owners before service boundaries.

### More Users

Expected pressure points:

- Postgres indexes on `household_id` plus query-specific columns.
- Shopping-list derivation performance.
- Price lookup job volume.
- Scraper job retry behavior.
- Dashboard/read-model query volume.

Add read models when repeated derived queries become expensive.

### Multi-Region

Recommended first model:

- Household-region affinity.
- One primary write region per household.
- Reads may be cached or replicated.
- Background workers process jobs in the household's region.
- Household migration between regions is explicit.

Avoid active-active writes for the same household until there is a demonstrated need and a conflict-resolution model.

---

## Decision Log Candidates

If this refactor moves beyond exploration, add decisions to `DECISIONS.md` for:

- Choosing ASP.NET Core as the backend runtime.
- Choosing modular monolith over microservices for the first .NET version.
- Choosing internal CQRS/vertical slices.
- Choosing EF Core or another data access approach.
- Choosing the auth migration strategy.
- Choosing deployment topology for the .NET API.

Do not silently update `ARCHITECTURE.md` until these are real decisions.

---

## Suggested Session Cadence

For each session with an agent:

1. Pick one unchecked item.
2. Ask the agent to explain the concept and show the relevant current TypeScript code.
3. Implement the .NET version manually.
4. Run the narrow test.
5. Ask the agent to review the diff.
6. Fix issues.
7. Run the broader relevant tests.
8. Commit only when tests have passed and you choose to commit.

Good stopping points:

- After a passing test.
- After one endpoint works.
- After one module slice reaches parity.
- Before any auth, tenancy, migration, or deployment decision.

---

## Current Recommended First Slice

Start with taxonomy review.

Reason:

- It is small enough to learn ASP.NET Core, EF Core, validation, and tests.
- It has real domain behavior.
- It touches the global curated taxonomy rule.
- It is represented clearly by `apps/server/src/lib/find-or-create-food.ts`.
- It does not require solving every inventory or shopping-list workflow first.

First target behavior:

```text
Given a proposed food name, category, and default unit:
- return existing when a case-insensitive exact canonical food match exists;
- otherwise return review with the proposed food and up to five partial matches;
- never create a canonical food implicitly.
```
