# Recipe Selection, Delete, and Add to Plan

**Date:** 2026-05-16
**Status:** Approved

## Overview

Add multi-select to the RecipesPage cards so users can delete recipes or add them to the meal plan in bulk. Also add a single-recipe "Add to plan" button in the recipe view modal. "Add to plan" fills the next available empty day(s) starting from today, scanning forward up to 28 days.

A separate spec will cover the PlanPage timeline change (2 weeks forward + 1 week past).

---

## Architecture

**New state:** `selectedIds: Set<string>` in `RecipesPage` via `useState`. Ephemeral — clears on navigation away or on action completion. No Zustand needed.

**No new API endpoints.** Uses:
- `DELETE /api/recipes/:id` — already exists
- `POST /api/meal-plans/entries` — already exists, accepts `{ weekStart, date, recipeId, servings }`

**New pieces:**
| Piece | File | Role |
|---|---|---|
| `RecipeCard` (modified) | `RecipesPage.tsx` | Corner checkbox, selected state |
| `SelectionBar` (new component) | `RecipesPage.tsx` | Sticky action bar when selection non-empty |
| `useAddToNextEmptyDays` (new hook) | `hooks/useMealPlan.ts` | Scans forward from today, POSTs entries |
| `RecipeForm` (modified) | `RecipeForm.tsx` | "Add to plan" button in read-only view |

---

## Component Design

### RecipeCard

Add two new optional props:
```ts
selected?: boolean
onSelect?: () => void
```

- A 32×32px circular tap target overlaid in the top-left corner of the card image area.
- Click on the circle calls `onSelect()` with `stopPropagation()` so the card body click (which opens the modal) is not triggered.
- When `selected=true`: filled circle with a checkmark glyph; card gets a CSS ring border (`outline`) and a semi-transparent tint overlay on the image.
- When `selected=false` (and `onSelect` is provided): empty ring (border only) — visible on hover/focus, always visible on touch devices.
- `dense` cards use the same logic, just the circle is 24×24px.
- When `onSelect` is `undefined`, no checkbox is rendered (preserves existing behaviour if needed later).

### SelectionBar

Sticky bar fixed to the viewport bottom. Slides up with a CSS `transform` transition when `selectedIds.size > 0`; hidden (translated off-screen) when empty.

Layout:
```
[ N selected  ×Clear ]  [ Add to plan ]  [ Delete ]
```

- **"Add to plan"** (primary): disabled while pending. On success shows inline "Added to Mon 19, Tue 20 …" for 2 seconds, then clears selection.
- **"Delete"** (destructive): transitions the bar into a confirmation state:
  ```
  [ Delete N recipes? This can't be undone. ]  [ Confirm ]  [ Cancel ]
  ```
  On confirm: calls `useDeleteRecipe` for each selected ID in parallel, invalidates the recipes query, clears selection.
- **"× Clear"**: resets selection immediately, no API call.
- Error state: if "Add to plan" partially fails, shows "Added X, Y had no empty day in the next 28 days" in the bar.

### RecipeForm (read-only view)

Current action row: `[Close]` `[Edit]`
New action row: `[Close]` `[Add to plan]` `[Edit]`

- "Add to plan" is a `btn-secondary` style button.
- On click: calls the add-to-plan logic for this single recipe (uses the recipe's existing `servings` value).
- While pending: button shows "Adding…" and is disabled.
- On success: button label changes to "Added to Mon 19" for 2 seconds, then resets.
- On error (no empty days in 28-day horizon): shows a small inline error below the button row.
- `RecipeForm` gains an optional `onAddToPlan?: (recipeId: string, servings: number) => Promise<{ addedTo: string[] }>` prop, called by the parent (`RecipesPage`) which owns the hook. This keeps the hook out of `RecipeForm` and avoids prop-drilling the query client.

---

## "Add to Next Empty Days" Logic

### Hook: `useAddToNextEmptyDays`

```ts
function useAddToNextEmptyDays(): {
  mutateAsync: (items: { recipeId: string; servings: number }[]) => Promise<{ addedTo: string[]; skipped: string[] }>;
  isPending: boolean;
}
```

**Algorithm (imperative, runs inside `mutateAsync`):**

1. Build a list of candidate dates: today, today+1, today+2 … today+27 (28 entries).
2. Group candidate dates by `mondayOf(date)` — produces at most 4 distinct `weekStart` values.
3. Fetch all required week plans in parallel via `GET /api/meal-plans?weekStart=`.
4. For each candidate date in order, check whether the fetched plan has any entries on that date. Collect dates with zero entries as "empty days".
5. Pair `items[0]` → `emptyDays[0]`, `items[1]` → `emptyDays[1]`, etc.
6. Items beyond available empty days go into `skipped`.
7. POST each pair to `POST /api/meal-plans/entries` (in parallel).
8. Invalidate all affected `['meal-plan', weekStart]` query keys.
9. Return `{ addedTo: ['Mon 19 May', 'Tue 20 May', …], skipped: ['Recipe Name', …] }`.

**Key invariant:** `weekStart` passed to the API is always `toIsoDate(mondayOf(targetDate))`. The user never sees or interacts with this value.

---

## Delete Flow

1. User clicks "Delete" in `SelectionBar`.
2. Bar transitions to confirmation state (no `window.confirm` — inline only).
3. User clicks "Confirm": all selected recipe IDs are deleted in parallel via `DELETE /api/recipes/:id`.
4. On all-success: invalidate `['recipes']`, clear selection.
5. On partial failure: show error message listing which recipes failed to delete; clear selection for the ones that succeeded.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| No empty days in 28-day horizon | Inline error in SelectionBar / RecipeForm: "No empty days available in the next 4 weeks." |
| Partial placement (some fit, some don't) | "Added to [days]. [N] recipe(s) had no available day." |
| Delete API failure | "Failed to delete [Name]. Try again." |
| Add-to-plan API failure | "Failed to add [Name] to the plan. Try again." |

---

## Tests

- **Unit — `useAddToNextEmptyDays`**: mock the fetch responses for 1–4 weeks; assert correct date pairing, skipped list, and API call count.
- **Unit — `RecipeCard`**: assert that clicking the checkbox calls `onSelect` and that clicking the card body calls `onOpen`; assert selected CSS class applied.
- **Unit — `SelectionBar`**: assert confirmation state transition for delete, and success message after add-to-plan.
- **Update existing `RecipeForm` tests** to cover the new "Add to plan" button in read-only view (rendered, disabled while pending, shows success label).
- No new E2E tests for this slice (feature is self-contained UI with no new server routes).

---

## Out of Scope (separate spec)

- PlanPage timeline expansion (2 weeks forward + 1 week past from today).
