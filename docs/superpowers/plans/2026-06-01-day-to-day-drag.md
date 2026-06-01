# Day-to-Day Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree:** Create an isolated worktree before starting — use the `superpowers:using-git-worktrees` skill.
>
> **Recommended model:** claude-sonnet-4-6

**Goal:** Allow dragging a meal plan entry from one day card to another day to move it. The entry's date is updated via the existing `PATCH` endpoint. If the target day already has entries, the recipe is added as an additional entry (up to the existing MAX_ENTRIES_PER_DAY cap).

**Architecture:** Add a second drag type constant `DRAG_ENTRY_TYPE` alongside the existing `DRAG_TYPE`. Day card entries get `draggable` + `onDragStart`. The `DayCard.onDrop` handler already exists — it's extended to check for both drag types. PlanPage gains a `handleMoveEntry(entryId, targetDate)` function that calls `updateEntry.mutate({ id, date })`. Source-day drops are blocked by checking that the dragged entry's date != the target day's date (passed in the drag data).

**Tech Stack:** React drag events (HTML5 DnD, already used), `useUpdateMealPlanEntry` hook (already exists and supports `date` updates).

---

## File map

| File | Change |
|---|---|
| `apps/web/src/pages/PlanPage/PlanPage.tsx` | New drag type constant, draggable entries, extended drop handler, move handler |
| `apps/web/src/pages/PlanPage/PlanPage.css` | Draggable cursor style on day entry |

No new hooks or server changes needed — `useUpdateMealPlanEntry` already supports `{ id, date }`.

---

## Task 1: Make day card entries draggable

**Files:**
- Modify: `apps/web/src/pages/PlanPage/PlanPage.tsx`
- Modify: `apps/web/src/pages/PlanPage/PlanPage.css`

- [ ] **Step 1: Add the DRAG_ENTRY_TYPE constant**

In `PlanPage.tsx`, find:
```tsx
const DRAG_TYPE = 'application/x-eat-recipe-id';
```
Add the new type below it:
```tsx
const DRAG_ENTRY_TYPE = 'application/x-eat-entry-id';
const DRAG_ENTRY_DATE_TYPE = 'application/x-eat-entry-date';
```

- [ ] **Step 2: Add onMoveEntry prop to DayCard**

Find the `DayCard` props interface:
```tsx
function DayCard({
  iso,
  label,
  isToday,
  isPast,
  entries,
  onDropRecipe,
  onUpdateEntry,
  onDeleteEntry,
  onMarkCookedEntry,
}: {
  ...
  onMarkCookedEntry: (id: string) => void;
})
```
Add `onMoveEntry` after `onMarkCookedEntry`:
```tsx
function DayCard({
  iso,
  label,
  isToday,
  isPast,
  entries,
  onDropRecipe,
  onUpdateEntry,
  onDeleteEntry,
  onMarkCookedEntry,
  onMoveEntry,
}: {
  iso: string;
  label: string;
  isToday: boolean;
  isPast: boolean;
  entries: DayEntry[];
  onDropRecipe: (recipeId: string) => void;
  onUpdateEntry: (id: string, patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDeleteEntry: (id: string) => void;
  onMarkCookedEntry: (id: string) => void;
  onMoveEntry: (entryId: string) => void;
})
```

- [ ] **Step 3: Make the recipe name/image draggable**

Inside `DayCard`, find the block that renders `first.recipe` — specifically the `day-col-image` and `day-col-name` divs:
```tsx
<div className="day-col-image">
  {first.recipe?.sourceImage
    ? <img src={first.recipe.sourceImage} alt="" />
    : <span className="day-col-image-fallback">{first.entry.recipeName}</span>}
</div>
<div className={`day-col-name${isPast ? ' day-col-name--past' : ''}`}>{first.entry.recipeName}</div>
```
Wrap both in a draggable container div:
```tsx
<div
  className="day-col-drag-handle"
  draggable={!isPast}
  onDragStart={(e) => {
    e.dataTransfer.setData(DRAG_ENTRY_TYPE, first.entry.id);
    e.dataTransfer.setData(DRAG_ENTRY_DATE_TYPE, iso);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  }}
>
  <div className="day-col-image">
    {first.recipe?.sourceImage
      ? <img src={first.recipe.sourceImage} alt="" />
      : <span className="day-col-image-fallback">{first.entry.recipeName}</span>}
  </div>
  <div className={`day-col-name${isPast ? ' day-col-name--past' : ''}`}>{first.entry.recipeName}</div>
</div>
```

- [ ] **Step 4: Extend onDrop to handle DRAG_ENTRY_TYPE**

Find the existing `onDrop` function in `DayCard`:
```tsx
function onDrop(e: React.DragEvent) {
  if (atCapacity || isPast) return;
  e.preventDefault();
  setDragOver(false);
  const recipeId = e.dataTransfer.getData(DRAG_TYPE);
  if (recipeId) onDropRecipe(recipeId);
}
```
Replace with:
```tsx
function onDrop(e: React.DragEvent) {
  if (atCapacity || isPast) return;
  e.preventDefault();
  setDragOver(false);

  const recipeId = e.dataTransfer.getData(DRAG_TYPE);
  if (recipeId) { onDropRecipe(recipeId); return; }

  const entryId = e.dataTransfer.getData(DRAG_ENTRY_TYPE);
  const sourceDate = e.dataTransfer.getData(DRAG_ENTRY_DATE_TYPE);
  if (entryId && sourceDate !== iso) {
    onMoveEntry(entryId);
  }
}
```
The `sourceDate !== iso` check prevents dropping back onto the same day.

- [ ] **Step 5: Add draggable cursor style**

In `PlanPage.css`, add:
```css
.day-col-drag-handle {
  cursor: grab;
}
.day-col-drag-handle:active {
  cursor: grabbing;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/PlanPage/PlanPage.tsx apps/web/src/pages/PlanPage/PlanPage.css
git commit -m "feat: day entries draggable — ready for move handler"
```

---

## Task 2: Wire up the move handler in PlanPage

**Files:**
- Modify: `apps/web/src/pages/PlanPage/PlanPage.tsx`

- [ ] **Step 1: Add handleMoveEntry to PlanPage**

In `PlanPage`, find:
```tsx
function handleDrop(date: string, recipeId: string) {
  const recipe = recipes.find((r) => r.id === recipeId);
  addEntry.mutate({ date, recipeId, servings: recipe?.servings ?? 1 });
}
```
Add after it:
```tsx
function handleMoveEntry(entryId: string, targetDate: string) {
  updateEntry.mutate({ id: entryId, date: targetDate });
}
```

- [ ] **Step 2: Pass onMoveEntry to each DayCard**

Find the `DayCard` instantiation in the `plan-week-rail`:
```tsx
<DayCard
  key={d.iso}
  iso={d.iso}
  label={d.label}
  isToday={d.isToday}
  isPast={d.isPast}
  entries={entriesByDay[d.iso] ?? []}
  onDropRecipe={(recipeId) => handleDrop(d.iso, recipeId)}
  onUpdateEntry={(id, patch) => updateEntry.mutate({ id, ...patch })}
  onDeleteEntry={(id) => deleteEntry.mutate(id)}
  onMarkCookedEntry={(id) => setCookingEntryId(id)}
/>
```
Add `onMoveEntry`:
```tsx
<DayCard
  key={d.iso}
  iso={d.iso}
  label={d.label}
  isToday={d.isToday}
  isPast={d.isPast}
  entries={entriesByDay[d.iso] ?? []}
  onDropRecipe={(recipeId) => handleDrop(d.iso, recipeId)}
  onUpdateEntry={(id, patch) => updateEntry.mutate({ id, ...patch })}
  onDeleteEntry={(id) => deleteEntry.mutate(id)}
  onMarkCookedEntry={(id) => setCookingEntryId(id)}
  onMoveEntry={(entryId) => handleMoveEntry(entryId, d.iso)}
/>
```

- [ ] **Step 3: Run type-check to confirm no TypeScript errors**

```bash
pnpm --filter @eat/web build 2>&1 | grep -E "error TS|warning TS" | head -20
```
Expected: no TypeScript errors.

- [ ] **Step 4: Write a unit test for handleMoveEntry**

In `apps/web/src/hooks/useMealPlan.test.tsx`, the existing test file has tests for the hook. Add a comment verifying the `UpdateMealPlanEntryInput` type supports `date`:
```bash
grep -n "date" apps/web/src/hooks/useMealPlan.ts
```
Expected: see `date: isoDate.optional()` in the relevant type. Confirm visually — no code change needed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/PlanPage/PlanPage.tsx
git commit -m "feat: drag meal plan entry between days to move it"
```

---

## Self-review checklist

After all tasks:
- [ ] Run `pnpm --filter @eat/web test` — all tests pass.
- [ ] Manual test: drag a recipe from the recipe grid onto a day (existing behaviour — must still work). Then drag the entry from one day to another (new behaviour — entry moves). Verify the moved entry no longer appears on the source day.
- [ ] Verify dragging an entry onto the same day it's already on does nothing (no flicker, no duplicate).
- [ ] Verify past days are not valid drop targets (existing behaviour).
