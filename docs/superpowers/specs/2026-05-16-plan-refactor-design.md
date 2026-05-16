# Plan Refactor — Design Spec

**Date:** 2026-05-16  
**Status:** Approved

## Problem

The current plan is modelled as fixed Monday–Sunday weeks. It forces the user to think in "this week / last week" terms, requires selecting the right week to see today, and auto-generates the shopping list whenever a recipe is added. None of this matches how a household actually plans meals.

## Goal

- Plan page opens centred on today (today is always the 3rd visible column; 2 past days, 14 future days).
- Horizontal scroll across a rolling 17-day window.
- Up to 4 recipes per day (UI-enforced only).
- No auto-add to shopping list when recipes are planned.
- Shopping list has an explicit "Add from planned recipes" modal that lets the user select which upcoming days contribute to the list.

## Decisions

- Approach C selected: drop `meal_plans` table entirely. `meal_plan_entries` owns `household_id` directly.
- One recipe per `meal_plan_entry` row (unchanged). Multiple recipes on one day = multiple rows sharing `date`.
- Shopping list modal re-derives all recipe-sourced items from selected entries (full replace of `source: 'recipe'` items). Manual and staple items are never touched.
- No per-item source tracking column needed.

---

## 1. Database Migration

Drop `meal_plans` table. Update `meal_plan_entries`:

**Remove:**
- `meal_plan_id` (FK to `meal_plans`)

**Add:**
- `household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE`

Drop `shopping_lists.generated_from_meal_plan_id` column (concept no longer exists).

**`meal_plan_entries` after migration:**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `household_id` | uuid FK | replaces meal_plan_id indirection |
| `date` | date NOT NULL | the actual day |
| `recipe_id` | uuid FK → recipes | |
| `servings` | double precision | |
| `status` | enum (planned/cooked/skipped) | |
| `created_at` | timestamp | |

No data migration needed (no real users).

---

## 2. API Changes

### Removed
- `GET /api/meal-plans?weekStart=` — replaced by date-range endpoint
- `meal_plans` routes entirely

### New / Changed

**`GET /api/meal-plans/entries?from=YYYY-MM-DD&to=YYYY-MM-DD`**  
Returns all `meal_plan_entries` for the household within the date range (inclusive). Response: `{ entries: MealPlanEntry[] }`.

**`POST /api/meal-plans/entries`**  
Body: `{ date, recipeId, servings }` — no `weekStart`. Server derives nothing extra; just inserts with `household_id` from session.

**`PUT /api/meal-plans/entries/:id`** — unchanged  
**`DELETE /api/meal-plans/entries/:id`** — unchanged

**`POST /api/shopping-lists/from-plan`**  
Body: `{ entryIds: uuid[] }`.  
Behaviour:
1. Delete all `shopping_list_items` where `source = 'recipe'` on the current list.
2. Fetch recipe ingredients for each entry in `entryIds`.
3. Aggregate ingredients (Σ qty per canonical food), subtract current inventory, insert new recipe-sourced items.
4. Manual and staple items untouched.  
Response: updated `ShoppingList`.

### Removed
- `POST /api/shopping-lists/generate` — replaced by `from-plan`. Remove endpoint and all call sites.

### Unchanged
- All shopping list item CRUD endpoints
- Staples

---

## 3. Plan Page — Frontend

### Rolling window
- Always 17 days: `today − 2` through `today + 14`.
- On mount, scroll position set so today is at column index 2 (0-based), i.e. the 3rd visible column.
- No "previous week / next week" buttons. Scroll is the only navigation.

### Layout
```
← [ Sun 11 ] [ Mon 12 ] [ Tue 13▲TODAY ] [ Wed 14 ] [ Thu 15 ] ... →
```
Horizontal scroll-snap, same column card design as today.

### Capacity
- A day card with 4 entries hides the drop zone and the "tap +" fallback. No server enforcement.

### Data fetching
- `useMealPlanEntries(from, to)` replaces `useMealPlanWeek(weekStart)`.
- Single query for the full 17-day window on load.
- `useAddMealPlanEntry` no longer calls `/api/shopping-lists/generate` on success.
- `useAddToNextEmptyDays` (used when adding recipes from other pages) also removes its `/api/shopping-lists/generate` call.

### Proportion strip
- Calculated across all 17 days (not just a week).

### Shared types (packages/shared)
- Remove `MealPlanWeek`, `CreateMealPlanEntryInput.weekStart`.
- Add `MealPlanEntriesResponse`, update `CreateMealPlanEntryInput`.

---

## 4. Shopping List Page — Frontend

### Button rename
"Generate for this week" → **"Add from planned recipes"**. Shown in the page header regardless of whether a list exists (replaces the empty-state generate button too).

### Modal: Add from planned recipes

Shows upcoming days from **today → today + 14** that have at least one planned entry. Past days are excluded.

```
┌─ Add from planned recipes ──────────────────────┐
│  ☑ Wed 14 May   Pasta Bolognese                 │
│  ☐ Thu 15 May   Butter Chicken                  │
│  ☑ Fri 16 May   Chicken Stir Fry                │
│  ☐ Sat 17 May   (2 recipes)                     │
│                                  [ Update list ] │
└─────────────────────────────────────────────────┘
```

**Pre-ticking logic:** A day is pre-ticked only if **all** entries on that day have their recipe represented in the current recipe-sourced list items. Partial (some but not all recipes from a day already on the list) = un-ticked. This requires knowing which recipe IDs currently contribute to the list.

To enable this, add `source_recipe_id uuid` (nullable) to `shopping_list_items`. Only recipe-sourced items carry it. This is not used for subtraction logic (re-derive handles that) — purely for pre-tick matching. On modal open: collect the set of `source_recipe_id`s from current recipe items; a day is pre-ticked if every entry's `recipe_id` is in that set.

**On "Update list":** Calls `POST /api/shopping-lists/from-plan` with all entry IDs from ticked days. Replaces recipe-sourced items. Modal closes.

**Empty state:** If no upcoming days have planned entries, modal shows "No planned recipes in the next 2 weeks. Add recipes to your plan first."

---

## 5. Tests

- Unit: date-window helpers (17-day range, today-at-index-2 scroll offset).
- Unit: `from-plan` route — correct recipe-sourced item replacement, manual/staple items preserved.
- Unit: pre-tick logic — days with matching recipe IDs are pre-ticked.
- E2E: add recipe to plan → shopping list not auto-updated. Open modal → select day → list updates with recipe ingredients.
- E2E: manual item survives modal update.
- Remove: E2E tests asserting auto-generate on plan entry add.

---

## Out of Scope (follow-up)

- "Load date" for planning far in the future (user noted as follow-up).
- Pak'nSave / Woolworths bootstrap (Phase 3 slice 2, unrelated).
