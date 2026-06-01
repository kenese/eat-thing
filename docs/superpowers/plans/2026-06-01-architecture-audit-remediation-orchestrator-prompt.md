# Architecture-Audit Remediation Orchestrator Prompt

Use this prompt in a new Codex thread running in a clean `main`-based worktree.
Select `gpt-5.4` with medium reasoning for the orchestrator.

```markdown
Act as the token-efficient orchestrator for eat-thing architecture-audit remediation Slices B, C, and D.

Read `AGENTS.md`, `PLAN.md`, `ARCHITECTURE.md`, `DECISIONS.md`, and `architecture-audit-recommendations.html` first. Work in this isolated worktree. Preserve unrelated user edits.

Keep coordination lean:
- Delegate only the bounded implementation tasks below.
- Give workers the exact task, relevant repo rules, likely files, and acceptance criteria.
- Tell workers not to reread broad docs unless necessary.
- Avoid separate reviewer agents unless a worker reports uncertainty or integration reveals a risk.
- Require each worker to report changed files, focused tests run, concerns, and commit SHA.
- Do not allow parallel workers to modify overlapping files.
- Use TDD for behavior changes.
- Keep all `household_id` scoping rules intact.
- Update `PLAN.md` only after integration and required verification pass.

Run a baseline first:

~~~bash
pnpm test
pnpm test:e2e
~~~

If either fails, report the failures and ask before proceeding.

## Wave 1

Dispatch these workers in parallel where their write paths remain disjoint:

### Worker A: Slice B low-stock staples

Preferred model: `gpt-5.4`, medium reasoning.

Goal:
- Add one shared server-side low-stock staples derivation using current inventory and unit conversion.
- Merge low-stock staple items into the current shopping list when `POST /api/shopping-lists/from-plan` runs.
- Preserve manual shopping-list items.
- Wire the Inventory sidebar "Low staples" widget to the same server behavior.
- Add relevant Vitest and Playwright E2E coverage.

Coordinate with Worker B before editing inventory unit-validation code. Worker A owns low-stock derivation, shopping-list integration, Inventory widget rendering, and related tests.

### Worker B: Slice C1 and C5

Preferred model: `gpt-5.4-mini`, medium reasoning.

Goal:
- Restrict inventory storage units to canonical `g`, `ml`, or `count`.
- Include API validation and any required migration strategy for existing data.
- Enforce the four-recipes-per-day limit in the meal-plan API, including entry moves on update.
- Add relevant unit tests and Playwright E2E coverage.

Worker B owns inventory-unit validation, migration work, meal-plan invariant work, and related tests. Avoid Inventory widget rendering files owned by Worker A.

### Worker C: Slice C2 and C3

Preferred model: `gpt-5.4`, medium reasoning.

Goal:
- Audit and complete preservation of original recipe ingredient quantity/unit text while retaining normalized metric annotations for calculations.
- Accept and persist `recipes.total_time_minutes` and `recipes.tags` through recipe create/update routes and all import paths.
- Update shared types, web form behavior where needed, and relevant Vitest and Playwright E2E coverage.

Worker C owns recipe routes, recipe types, importers, recipe form plumbing, and related tests.

Do not dispatch a separate worker for D1. Delete the obsolete
`apps/server/launchd/com.eat-thing.openbrain-sync.plist`
during integration.

## Integration Gate

After Wave 1:

1. Review worker summaries and commits.
2. Resolve conflicts carefully without reverting unrelated work.
3. Integrate Slice C1 before declaring Slice B complete.
4. Delete the obsolete OpenBrain plist.
5. Run:

~~~bash
pnpm test
pnpm test:e2e
~~~

6. Update `PLAN.md` only for work genuinely complete after both suites pass.

## Wave 2: Taxonomy Review Design Gate

Only after Slice B is complete, handle Slice C4:

- Replace silent global `canonical_foods` insertion with an explicit confirm-new-food taxonomy-review step.
- First inspect all current `findOrCreateFood` call sites.
- Propose a concise UX/API design and migration impact.
- Ask the user to approve the design before implementation.
- After approval, implement with `gpt-5.4`, high reasoning.
- Add relevant Vitest and Playwright E2E coverage.

## Final Documentation Pass

After runtime work is verified:

- Update `ARCHITECTURE.md` accurately.
- Add a new numbered entry to `DECISIONS.md`.
- Update `PLAN.md`, moving completed remediation work to Done with the date.
- Audit `AGENTS.md` and `CLAUDE.md` for stale architecture claims and update them where needed.
- Document Mac-mini scraper `launchd` supervision as planned until its scraper plist lands.
- Do not claim shopping-list finalization exists.
- Describe mutable inventory balances plus append-only cooking audit events.
- Describe public recipe-photo URLs and no inventory photos.
- Describe Meal Planner HTTP MCP with local stdio fallback.
- Describe single-household-first middleware, actual Better-Auth tables, and global-table exceptions.
- State that cook prompts are retained for audit and future refinement.

Finish by running:

~~~bash
pnpm test
pnpm test:e2e
git status --short
~~~

Report:
- completed items
- worker commits
- final verification output
- any incomplete or blocked work
- any docs/config-only changes that genuinely required no additional tests

If Worker A and Worker B both need the same inventory files, have Worker A finish the server derivation first and Worker B apply unit validation immediately afterward. Prefer a short sequential handoff over resolving a noisy merge conflict.
```
