---
name: feature-sprint
description: Build a single feature as a full sprint with approval gates, verification, and documentation updates. Use when the user describes a feature to build and wants structured delivery with PLAN.md tracking, ARCHITECTURE.md updates, and decision logging.
---

# Feature Sprint

## Purpose

Use this skill when the user asks you to build a single feature. Each feature is treated as one complete sprint with approval gates and verification before completion.

## Required Behavior

- Treat the **entire feature as one sprint**. Do not split it into mini-sprints unless the user asks or it is clearly necessary — ask first.
- A feature **stays active** from invocation until the user explicitly confirms completion at the completion gate. Any tweaks or follow-up requests before that confirmation are iterations on the same feature and must be included in the final documentation.
- Build only what was requested. Do not add unrequested features.
- If something breaks, fix it before continuing.
- Keep explanations concise unless the user asks for detail.
- Support pause/resume across sessions using `PLAN.md`.

## Default Build Order

Implement in this order when relevant:

1. `packages/shared` — types and state contract changes
2. `apps/server` — handlers or API behavior
3. `apps/web` — UI and client behavior

## First Feature (App Bootstrap)

If `PLAN.md` does not exist, this is the first feature. The user's request **must** include what the overall app is (e.g. "we are building a task management app"). If they didn't provide this, ask: _"What app are we building?"_ before proceeding. The app goal is recorded in `PLAN.md` under **App Goal** and never removed.

## Session Start

1. Read `ARCHITECTURE.md` if it exists.
2. Read `PLAN.md` if it exists.
3. Read `DECISIONS.md` if it exists.
4. **Concurrency check**: if `PLAN.md` has any active sprints with `in_progress` status, check whether their scopes overlap with this feature's scope. If scopes overlap, warn: _"Active sprint [name] is working in [scope]. This feature also touches that area — proceeding may cause file conflicts."_ Let the user decide whether to continue. Non-overlapping sprints are fine.
5. Restate the feature in one sentence.
6. Propose a plan and wait for approval. Once approved, write `PLAN.md` immediately, then begin coding.

## Persistent Plan File (`PLAN.md`)

Maintain a root-level `PLAN.md` as the source of truth for the current feature.

### When to create/update

1. Create `PLAN.md` if it does not exist.
2. **Write or refresh the plan as soon as the user confirms at the plan gate** — before any coding. Do not defer until sprint completion or session end; other agents need to see it immediately.
3. Update immediately after verification and on scope changes.
4. On session end, leave clear next steps so another agent can continue.

### Required structure

```md
# Plan

## App Goal
<what we are building — set once on first feature, never removed>

## Context
- Last updated: <date/time>

## Completed Features
- [x] Feature A
- [x] Feature B

## Active Sprints

### <Feature Name>
- Status: planned | in_progress | blocked | completed
- Scope: <directories this feature touches, e.g. apps/web, packages/shared>
- Plan: <1-3 bullets>
- Verification: <tests/screenshots/manual checks>
- Notes: <important decisions, blockers, scope changes>
- Next step: <single clear next action for this sprint>
```

Each active sprint gets its own subsection under **Active Sprints**. When a feature completes, move it to **Completed Features** and remove its subsection.

## Mandatory Approval Gates

Do not proceed past any gate until the user confirms.

1. **Plan gate**: share a 1-2 sentence plan for the full feature and ask for approval. **As soon as the user confirms**, write/update `PLAN.md` immediately — before any coding. This ensures other agents see the plan right away; do not defer the write until later.
2. **Sprint gate**: implement the feature, then stop and report exactly what changed.
3. **Verification gate**: run browser-based visual verification when available and provide evidence (screenshot when possible). If browser tooling is unavailable, run available checks and request manual visual verification.
4. **Approval gate**: ask the user to confirm they are happy with the feature before proceeding to testing.
5. **Testing gate**: after the user approves, add all required tests (see Testing Phase below), then report what was added. The feature is **not complete** until all tests pass.

## Testing Phase (mandatory — runs after approval gate)

Once the user confirms they are happy with the feature, add the following tests before proceeding to completion:

### 1. Unit Tests
- Add unit tests for every new component, hook, utility, or store module introduced by the feature.
- Co-locate test files next to the source file (e.g. `Component.test.tsx` beside `Component.tsx`).
- Use the project's existing test framework (Vitest).

### 2. Storybook Stories
- Add Storybook stories for every new UI component.
- Cover the default state plus meaningful variants (e.g. loading, empty, error, interactive states).
- Co-locate story files next to the component (e.g. `Component.stories.tsx`).

### 3. E2E Tests (Playwright)
- Add Playwright tests that cover the primary user flows introduced by the feature.
- Place test files in `apps/web/tests/`.
- Each test should verify the happy-path behavior a user would exercise.

### Verification
- Run unit tests (`pnpm test`) and confirm they pass.
- Run E2E tests (`pnpm exec playwright test`) and confirm they pass.
- Report results to the user. If any tests fail, fix them before proceeding.

## Feature Completion (mandatory)

A feature is complete only after all tests from the Testing Phase pass. Then:

1. **Update `ARCHITECTURE.md`** to reflect the current state of the system. Add or revise sections for any new components, data flows, API endpoints, or patterns introduced by this feature. `ARCHITECTURE.md` must always describe the system as it exists *now*.
2. **Append to `DECISIONS.md`** with a summary of the feature and key decisions. Use this format:

```md
## <Feature Name> — <date>

**What**: <1-2 sentence summary of what was built>

**Key decisions**:
- <decision 1 and reasoning>
- <decision 2 and reasoning>

**Trade-offs / alternatives considered**:
- <anything rejected and why>
```

3. **Update `PLAN.md`** — move the feature to the completed list, remove its subsection from Active Sprints, and update the next step.

## Per-Sprint Response Format

After the sprint, respond in this structure:

1. `Intent`: feature targeted (1 sentence)
2. `Changes`: key files and behaviors updated
3. `Verification`: visual/test result and any evidence
4. `Status`: done, partial, or blocked
5. `Plan Update`: what was changed in `PLAN.md`
6. `Question`: explicit approval request before proceeding

## Constraints

- Keep existing dark theme and design tokens.
- Keep top navigation layout unless user asks otherwise.
- Use Zustand for client state.
- Follow existing API client patterns for new features.
- Avoid broad refactors unless required to unblock the feature.
