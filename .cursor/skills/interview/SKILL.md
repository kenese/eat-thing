---
name: interview-build-loop
description: Build timed interview apps feature-by-feature where each feature is a full sprint, with mandatory verification, approval gates, and a persistent PLAN.md for cross-session continuity. Use when the user describes an app to build during an interview and wants iterative delivery with clear progress tracking.
---

# Interview Build Loop

## Purpose

Use this skill when the user is building an app in a timed interview and wants fast feature-by-feature delivery with clear check-ins.

## Required Behavior

- Treat **one feature as one sprint**.
- Do not split a single feature into multiple mini-sprints unless the user asks, or you feel it is very necessary. Then ask first and only split with user confirmation
- Work feature-by-feature in priority order.
- If something breaks, fix it before continuing.
- Do not add unrequested features.
- Keep explanations concise unless the user asks for detail.
- Do not require completion in one chat session; support pause/resume cleanly using `PLAN.md`.

## Default Build Order

For each feature sprint, implement in this order when relevant:

1. `packages/shared` types/state contract changes
2. `apps/server` handlers or API behavior
3. `apps/web` UI and client behavior

## Persistent Plan File (`PLAN.md`)

Maintain a root-level `PLAN.md` as the source of truth for progress across agents/sessions.

### When to create/update

1. If `PLAN.md` does not exist at sprint start, create it.
2. Write or refresh the plan before coding starts.
3. Update it immediately after verification and when scope changes.
4. On session end, leave clear next steps so another agent can continue.

### Required `PLAN.md` structure

Use this format:

```md
# Interview Plan

## Context
- Goal: <app/interview goal>
- Source brief: <file/path>
- Last updated: <date/time>

## Feature Sprints
1. [ ] Feature 1 - <name>
2. [ ] Feature 2 - <name>
3. [ ] Feature 3 - <name>
...

## Active Sprint
- Feature: <current feature>
- Status: planned | in_progress | blocked | completed
- Plan: <1-3 bullets>
- Verification: <tests/screenshots/manual checks>
- Notes: <important decisions, blockers, scope changes>

## Next Step
- <single clear next action>
```

Mark completed features as `[x]` and keep unfinished features as `[ ]`.

## Mandatory Approval Gates

Do not proceed past any gate until the user confirms.

For each feature:

1. **Plan gate**: share a 1-2 sentence plan for the **full feature sprint**, write/update `PLAN.md`, and ask for approval.
2. **Sprint gate**: implement the feature sprint, then stop and report exactly what changed.
3. **Verification gate**: run browser-based visual verification when available and provide evidence (screenshot when possible). If browser tooling is unavailable, run available checks and request manual visual verification.
4. **Proceed gate**: ask if the user wants:
   - continue to the next feature sprint, or
   - pause and resume later (with `PLAN.md` updated), or
   - move to the next feature.

Never auto-advance to the next feature without explicit approval.

## Per-Sprint Response Format

After each sprint, respond in this structure:

1. `Intent`: feature targeted in this sprint (1 sentence)
2. `Changes`: key files and behaviors updated
3. `Verification`: visual/test result and any evidence
4. `Status`: done, partial, or blocked
5. `Plan Update`: what was changed in `PLAN.md`
6. `Question`: explicit approval request before proceeding

## Constraints To Respect

- Keep existing dark theme and design tokens.
- Keep top navigation layout unless user asks otherwise.
- Use Zustand for client state.
- Follow existing API client patterns for new features.
- Avoid broad refactors unless they are required to unblock the requested feature.

## Recommended Session Start

At session start:

1. Read `ARCHITECTURE.md`.
2. Read `PLAN.md` if it exists; otherwise create it from the interview brief.
3. Restate the current feature sprint in one sentence.
4. Propose the feature-level plan and ask for approval before coding.
5. ALways suggest updating PLAN.md if the plan has changed
