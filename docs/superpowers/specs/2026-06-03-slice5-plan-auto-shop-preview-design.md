# Slice 5 Plan Auto-Shop Preview Design

**Date:** 2026-06-03

**Status:** Approved for spec review

## Goal

Add a read-only auto-shop preview to the Plan page so the household can see what would be added to the active shopping list before mutating it. Confirming the preview must continue to use the existing `POST /api/shopping-lists/from-plan` flow and then navigate to `/list`.

## Scope

In scope:

- Household-scoped pre-flight API derived from selected planned recipes, current inventory, and low-stock staples
- Shared types for the preview response
- TanStack Query hook for preview loading
- Plan page preview panel with explicit loading, empty, error, and success states
- Confirm action that calls the existing shopping-list mutation and routes to `/list`
- Unit/component/E2E coverage for the new preview flow

Out of scope:

- Any mutation during preview
- Replacing the existing `POST /api/shopping-lists/from-plan` mutation path
- Price comparison, scraper orchestration, or delivery-window selection
- New list models beyond the existing active household shopping list

## Existing Context

The app already has the primitives Slice 5 should build on:

- `shopping_lists.scheduled_for` stores the household-local shopping day
- `POST /api/shopping-lists/from-plan` derives recipe gaps plus low-stock staples, preserves manual items, and updates the active list
- The Plan page already computes "needs shop" day summaries from meal-plan entries, recipe details, and current inventory
- The Shopping List route remains the source of truth for editable list state

That means Slice 5 should add visibility, not a new shopping-list mutation model.

## Product Decision

Confirmation will reuse the current `POST /api/shopping-lists/from-plan` endpoint and then navigate to `/list`.

Why:

- It keeps preview read-only and mutation logic centralized in one route
- It avoids inventing a second plan-specific write path
- It preserves the Shopping List page as the place where users edit, compare prices, and continue store-facing flows

## UX Design

### Entry point

The Plan page primary CTA remains the shopping-list action in the page-title controls, but the interaction changes from immediate navigation to preview-first.

Button behavior:

- Clicking the CTA opens the auto-shop preview panel
- The CTA count continues to reflect how many upcoming days currently need a shop

### Preview selection model

The preview should use the same set of meal-plan entries that the Plan page is already surfacing as shop-relevant in the active planning horizon:

- Include planned entries in the current 17-day window
- Exclude past entries
- Exclude entries already marked `cooked`
- Include only entries whose resolved day state is `shop` because inventory is currently insufficient

This keeps the panel aligned with what the user just saw on the Plan page and avoids a second picker inside Slice 5.

### Preview panel states

The panel should render four explicit UI states:

1. Loading
   - A compact loading message while the pre-flight request resolves

2. Empty
   - If no qualifying entries need a shop, explain that the upcoming plan is already covered and offer a direct link or button to `/list`

3. Error
   - If preview loading fails, show a retry affordance and a short explanation

4. Success
   - Show a concise summary, a small breakdown by source, and a short preview list of what would be added

### Success-state content

The success state should emphasize decision-making, not become a full shopping list clone. It should show:

- Shopping-day context using `scheduledFor` when present
- Number of selected planned recipes and number of affected days
- Count of preview rows that would be added
- A short breakdown between recipe-derived rows and staple-derived rows
- A compact list of preview items with quantity, unit, and source labeling

Copy direction:

- If `scheduledFor` exists, frame the preview as shopping for that date
- If no date exists, use generic "next shop" language

### Confirm behavior

The success state includes a single primary confirm button:

- Calls the existing `useApplyPlanToShoppingList()` mutation with the exact previewed `entryIds`
- On success, navigates to `/list`

Secondary actions:

- Close panel
- Retry when the preview state is error

No in-panel editing is added in Slice 5.

## API Design

### Route

Add a new household-scoped route:

- `POST /api/shopping-lists/preview-from-plan`

Request body:

```ts
{
  entryIds: string[];
}
```

This mirrors the existing `/from-plan` payload so the Plan page can preview and confirm from the same entry selection.

### Server behavior

The route must:

1. Validate the `entryIds` payload
2. Restrict queried meal-plan entries to the authenticated household
3. Derive recipe ingredient gaps using the same quantity normalization and inventory subtraction rules as `/from-plan`
4. Reuse the shared low-stock staples derivation
5. Load the current household shopping list if present only for context such as `scheduledFor`
6. Return preview data without creating, deleting, or updating any shopping-list rows

### Shared derivation rule

Slice 5 is a good point to extract the existing from-plan derivation into a shared server helper used by both:

- `POST /api/shopping-lists/from-plan`
- `POST /api/shopping-lists/preview-from-plan`

That helper should produce a mutation-ready derived payload while letting each route decide whether to write it or just serialize it.

This reduces drift between preview and confirmation.

### Response shape

Add a shared response type for the preview. Recommended shape:

```ts
interface ShoppingListFromPlanPreview {
  scheduledFor: string | null;
  entryIds: string[];
  dayCount: number;
  recipeCount: number;
  itemCount: number;
  recipeItemCount: number;
  stapleItemCount: number;
  items: Array<{
    canonicalFoodId: string;
    name: string;
    qty: number;
    unit: string;
    source: 'recipe' | 'staple';
    sourceRecipeNames: string[] | null;
    sourceRecipeId: string | null;
  }>;
}
```

Notes:

- `scheduledFor` mirrors the active list context
- `entryIds` makes it easy for the client to confirm exactly what it previewed
- The item rows intentionally omit shopping-list item ids because nothing is persisted yet

## Frontend Design

### Data hook

Add a new TanStack Query hook in `apps/web/src/hooks/useShoppingList.ts` for the preview route.

Recommended pattern:

- Disabled by default
- Triggered when the panel opens and qualifying `entryIds` exist
- Query key includes a stable copy of selected `entryIds`

This keeps preview loading explicit and avoids background churn while the user scrolls the plan.

### Plan page state

The Plan page should derive the preview entry set from the existing `entriesByDay` map and hold:

- whether the preview panel is open
- the selected `entryIds` for the current preview request

No new global state is needed.

### Component structure

Keep the UI surface local to the Plan page unless the file becomes unwieldy. Reasonable decomposition:

- Add a focused `AutoShopPreviewPanel` component under `apps/web/src/pages/PlanPage/`
- Keep selection logic in `PlanPage.tsx`
- Keep API fetching in the existing shopping-list hook module

This follows current page-local patterns without prematurely generalizing.

## Error Handling

Server:

- Return `400` for invalid payloads
- Return only household-owned data
- Never partially mutate because the route is read-only

Client:

- If there are no qualifying entries, do not fire the preview query; open the empty state directly
- If the preview request fails, show a retry button that re-runs the query
- Disable the confirm button while the existing `/from-plan` mutation is pending

## Testing Strategy

### Server tests

Add or extend route tests to prove:

- `preview-from-plan` rejects invalid payloads
- preview returns derived recipe and staple rows for the authenticated household
- preview does not perform writes
- preview returns `scheduledFor` from the active list when present
- preview excludes cross-household meal-plan entries

### Web component tests

Add Plan page coverage for:

- opening the preview
- empty state when no qualifying shop-needed entries exist
- loading and success rendering for preview data
- error state and retry path
- confirm calling the existing apply-to-list mutation and then navigating

### E2E

Extend `apps/web/tests/app.spec.ts` to cover:

- Plan page preview opens from the CTA
- Success state renders preview summary
- Confirm takes the user to `/list`

## Files Expected To Change

Server:

- `apps/server/src/routes/shopping-lists.ts`
- `apps/server/src/routes/shopping-lists.test.ts` and/or `apps/server/src/routes/shopping-lists.from-plan.test.ts`
- Possibly a new helper under `apps/server/src/lib/` for shared from-plan derivation

Shared:

- `packages/shared/src/index.ts`

Web:

- `apps/web/src/hooks/useShoppingList.ts`
- `apps/web/src/pages/PlanPage/PlanPage.tsx`
- `apps/web/src/pages/PlanPage/PlanPage.css`
- `apps/web/src/pages/PlanPage/PlanPage.test.tsx`
- Possibly a new `apps/web/src/pages/PlanPage/AutoShopPreviewPanel.tsx`
- `apps/web/tests/app.spec.ts`

## Acceptance Criteria

- Previewing from the Plan page does not mutate the shopping list
- The preview is derived from the same planned-entry rules used for actual list updates
- The preview clearly communicates loading, empty, error, and success states
- Confirming reuses `POST /api/shopping-lists/from-plan`
- Successful confirmation navigates to `/list`
- Relevant Vitest and Playwright coverage is updated
- `pnpm test` and `pnpm test:e2e` pass before the slice is marked done
