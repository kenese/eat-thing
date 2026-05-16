# Recipe Selection, Delete & Add to Plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add checkbox-based multi-select to RecipesPage cards with a sticky action bar for bulk "Add to plan" and "Delete" actions, plus a single-recipe "Add to plan" button in the recipe view modal.

**Architecture:** Selection state lives in `RecipesPage` as `useState<Set<string>>`. A `useAddToNextEmptyDays` hook handles the imperative plan-filling logic — scans forward from today up to 28 days, fetches week plans in parallel, POSTs entries. `RecipeCard` wraps in a `<div>` to allow a sibling checkbox `<button>` positioned absolutely. No new API endpoints.

**Tech Stack:** React 18, TanStack Query v5, Vitest + React Testing Library, plain CSS

---

## File Map

| File | Change |
|---|---|
| `apps/web/src/hooks/useMealPlan.ts` | Add `useAddToNextEmptyDays` hook + `mondayOf`/`addDays`/`toIsoDate` imports |
| `apps/web/src/hooks/useMealPlan.test.tsx` | Add tests for `useAddToNextEmptyDays` |
| `apps/web/src/pages/RecipesPage/RecipesPage.tsx` | Add `selectedIds` state, `SelectionBar` component, updated `RecipeCard` wrapper div + checkbox button, wire callbacks |
| `apps/web/src/pages/RecipesPage/RecipesPage.css` | Add `.rx-card-wrapper`, `.rx-card-select-btn`, selection ring, `.rx-selection-bar` styles |
| `apps/web/src/pages/RecipesPage/RecipeForm.tsx` | Add `onAddToPlan` prop + "Add to plan" button + local status state in read-only view |

---

## Task 1: `useAddToNextEmptyDays` hook

**Files:**
- Modify: `apps/web/src/hooks/useMealPlan.ts`
- Test: `apps/web/src/hooks/useMealPlan.test.tsx`

- [ ] **Step 1.1: Write the failing tests**

Open `apps/web/src/hooks/useMealPlan.test.tsx`. The file currently mocks `api` as `{ post: vi.fn() }`. Extend the mock to also include `get`, then add these two test cases inside a new `describe('useAddToNextEmptyDays')` block at the bottom of the file:

```tsx
// At the top of the file, update the mock:
vi.mock('../api/client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

// Add this import alongside the others:
import { useAddToNextEmptyDays } from './useMealPlan';

describe('useAddToNextEmptyDays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Fix "today" to Saturday 2026-05-16
    vi.setSystemTime(new Date('2026-05-16T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('places recipes into the next N empty days starting from today', async () => {
    // Week 1 (Mon 11 May): today (May 16) and tomorrow (May 17) occupied
    vi.mocked(api.get)
      .mockResolvedValueOnce({
        weekStart: '2026-05-11', mealPlanId: 'p1',
        entries: [
          { id: 'e1', mealPlanId: 'p1', date: '2026-05-16', recipeId: 'rx', recipeName: 'X', servings: 2, status: 'planned' },
          { id: 'e2', mealPlanId: 'p1', date: '2026-05-17', recipeId: 'ry', recipeName: 'Y', servings: 2, status: 'planned' },
        ],
      })
      // Week 2 (Mon 18 May): May 18 occupied
      .mockResolvedValueOnce({
        weekStart: '2026-05-18', mealPlanId: 'p2',
        entries: [
          { id: 'e3', mealPlanId: 'p2', date: '2026-05-18', recipeId: 'rz', recipeName: 'Z', servings: 2, status: 'planned' },
        ],
      })
      // Week 3 and 4: all empty
      .mockResolvedValueOnce({ weekStart: '2026-05-25', mealPlanId: null, entries: [] })
      .mockResolvedValueOnce({ weekStart: '2026-06-01', mealPlanId: null, entries: [] });

    vi.mocked(api.post).mockResolvedValue({});

    const { result } = renderHook(() => useAddToNextEmptyDays(), { wrapper });

    const out = await result.current.mutateAsync([
      { recipeId: 'recipe-1', servings: 2 },
      { recipeId: 'recipe-2', servings: 4 },
    ]);

    // Should fetch all 4 weeks (May 11, May 18, May 25, Jun 1)
    expect(api.get).toHaveBeenCalledTimes(4);

    // First empty day after today's occupied slots: May 19
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      weekStart: '2026-05-18',
      date: '2026-05-19',
      recipeId: 'recipe-1',
      servings: 2,
    });
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      weekStart: '2026-05-18',
      date: '2026-05-20',
      recipeId: 'recipe-2',
      servings: 4,
    });

    // Shopping list regenerated for the one affected week
    expect(api.post).toHaveBeenCalledWith('/api/shopping-lists/generate', { weekStart: '2026-05-18' });

    expect(out.skipped).toHaveLength(0);
    expect(out.addedTo).toHaveLength(2);
  });

  it('returns skipped recipes when fewer empty days than items', async () => {
    // All 28 days occupied in all 4 weeks
    const makeFullWeek = (weekStart: string) => ({
      weekStart, mealPlanId: 'px',
      entries: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart + 'T00:00:00');
        d.setDate(d.getDate() + i);
        const iso = d.toISOString().slice(0, 10);
        return { id: iso, mealPlanId: 'px', date: iso, recipeId: 'r0', recipeName: 'Q', servings: 2, status: 'planned' as const };
      }),
    });

    vi.mocked(api.get)
      .mockResolvedValueOnce(makeFullWeek('2026-05-11'))
      .mockResolvedValueOnce(makeFullWeek('2026-05-18'))
      .mockResolvedValueOnce(makeFullWeek('2026-05-25'))
      .mockResolvedValueOnce(makeFullWeek('2026-06-01'));

    vi.mocked(api.post).mockResolvedValue({});

    const { result } = renderHook(() => useAddToNextEmptyDays(), { wrapper });

    const out = await result.current.mutateAsync([
      { recipeId: 'recipe-1', servings: 2 },
      { recipeId: 'recipe-2', servings: 4 },
    ]);

    // No entries POSTed
    expect(api.post).not.toHaveBeenCalledWith('/api/meal-plans/entries', expect.anything());
    expect(out.addedTo).toHaveLength(0);
    expect(out.skipped).toEqual(['recipe-1', 'recipe-2']);
  });
});
```

- [ ] **Step 1.2: Run tests — expect FAIL (hook not yet implemented)**

```bash
pnpm --filter @eat/web test -- --run useMealPlan
```

Expected: 2 new tests fail with "useAddToNextEmptyDays is not a function" or similar.

- [ ] **Step 1.3: Implement the hook**

Open `apps/web/src/hooks/useMealPlan.ts`. Add the import for date utilities at the top, then append the hook:

```ts
// Add to the existing imports at the top of the file:
import { addDays, mondayOf, toIsoDate } from '../lib/dateUtils';
```

Then at the bottom of the file, add:

```ts
export function useAddToNextEmptyDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { recipeId: string; servings: number }[]) => {
      if (items.length === 0) return { addedTo: [] as string[], skipped: [] as string[] };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Build 28 candidate dates starting from today
      const candidates = Array.from({ length: 28 }, (_, i) => addDays(today, i));

      // Collect unique weekStart values in encounter order
      const weekStartSet = new Set(candidates.map(d => toIsoDate(mondayOf(d))));
      const weekStartIsos = [...weekStartSet];

      // Fetch all weeks in parallel
      const weekPlans = await Promise.all(
        weekStartIsos.map(ws => api.get<MealPlanWeek>(`/api/meal-plans?weekStart=${ws}`)),
      );

      // Build set of already-occupied dates
      const occupiedDates = new Set<string>();
      for (const plan of weekPlans) {
        for (const entry of plan.entries) {
          occupiedDates.add(entry.date);
        }
      }

      // Collect empty days in order, stopping once we have enough
      const emptyDays: { date: string; weekStart: string }[] = [];
      for (const d of candidates) {
        if (emptyDays.length >= items.length) break;
        const iso = toIsoDate(d);
        if (!occupiedDates.has(iso)) {
          emptyDays.push({ date: iso, weekStart: toIsoDate(mondayOf(d)) });
        }
      }

      const toPlace = items.slice(0, emptyDays.length);
      const skipped = items.slice(emptyDays.length);

      // Insert meal plan entries
      await Promise.all(
        toPlace.map((item, i) =>
          api.post('/api/meal-plans/entries', {
            weekStart: emptyDays[i].weekStart,
            date: emptyDays[i].date,
            recipeId: item.recipeId,
            servings: item.servings,
          }),
        ),
      );

      // Regenerate shopping lists for affected weeks
      const affectedWeeks = [...new Set(emptyDays.map(d => d.weekStart))];
      await Promise.all(
        affectedWeeks.map(ws => api.post('/api/shopping-lists/generate', { weekStart: ws })),
      );

      // Invalidate queries
      await Promise.all([
        ...affectedWeeks.map(ws => qc.invalidateQueries({ queryKey: ['meal-plan', ws] })),
        qc.invalidateQueries({ queryKey: ['shopping-list'] }),
      ]);

      const addedTo = emptyDays.map(d => {
        const dt = new Date(d.date + 'T00:00:00');
        return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      });

      return { addedTo, skipped: skipped.map(i => i.recipeId) };
    },
  });
}
```

- [ ] **Step 1.4: Run tests — expect PASS**

```bash
pnpm --filter @eat/web test -- --run useMealPlan
```

Expected: All tests in `useMealPlan.test.tsx` pass.

- [ ] **Step 1.5: Commit**

```bash
git add apps/web/src/hooks/useMealPlan.ts apps/web/src/hooks/useMealPlan.test.tsx
git commit -m "feat: add useAddToNextEmptyDays hook — scans forward from today to fill empty plan days"
```

---

## Task 2: RecipeCard checkbox + selection styles

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.tsx`
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.css`

- [ ] **Step 2.1: Export RecipeCard and write failing tests**

Create a new file `apps/web/src/pages/RecipesPage/RecipesPage.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecipeCard } from './RecipesPage';

const recipe = {
  id: 'r1',
  name: 'Pasta Carbonara',
  servings: 4,
  sourceImage: null,
  ingredientCount: 5,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const match = { bucket: 'library' as const, missing: [] };

describe('RecipeCard selection', () => {
  it('calls onOpen when card body is clicked', () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    render(<RecipeCard recipe={recipe} match={match} onOpen={onOpen} onSelect={onSelect} selected={false} />);
    fireEvent.click(screen.getByRole('button', { name: /pasta carbonara/i }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onSelect (not onOpen) when checkbox is clicked', () => {
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    render(<RecipeCard recipe={recipe} match={match} onOpen={onOpen} onSelect={onSelect} selected={false} />);
    fireEvent.click(screen.getByRole('button', { name: /select recipe/i }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows checkmark when selected=true', () => {
    render(<RecipeCard recipe={recipe} match={match} onOpen={vi.fn()} onSelect={vi.fn()} selected={true} />);
    expect(screen.getByRole('button', { name: /deselect recipe/i })).toBeInTheDocument();
  });

  it('renders no checkbox when onSelect is undefined', () => {
    render(<RecipeCard recipe={recipe} match={match} onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /select recipe/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2: Run tests — expect FAIL**

```bash
pnpm --filter @eat/web test -- --run RecipesPage
```

Expected: Tests fail because `RecipeCard` is not exported and doesn't have `selected`/`onSelect` props.

- [ ] **Step 2.3: Restructure RecipeCard in RecipesPage.tsx**

In `apps/web/src/pages/RecipesPage/RecipesPage.tsx`, replace the `RecipeCard` function (lines 20–64) with the following. The key changes are: (a) outer `<div className="rx-card-wrapper">` becomes the positioning root, (b) the card button gets `aria-label` for test targeting, (c) a sibling checkbox `<button>` is added.

```tsx
export function RecipeCard({
  recipe,
  match,
  dense,
  selected,
  onOpen,
  onSelect,
}: {
  recipe: RecipeSummary;
  match: MatchInfo;
  dense?: boolean;
  selected?: boolean;
  onOpen: () => void;
  onSelect?: () => void;
}) {
  return (
    <div className={`rx-card-wrapper${selected ? ' rx-card-wrapper--selected' : ''}`}>
      <button
        className={`rx-card${dense ? ' rx-card--dense' : ''}`}
        onClick={onOpen}
        aria-label={recipe.name}
      >
        <div className="rx-card-image">
          {recipe.sourceImage ? (
            <img src={recipe.sourceImage} alt="" />
          ) : (
            <span className="rx-card-image-fallback">{recipe.name}</span>
          )}
          <div className="rx-card-badge">
            {match.bucket === 'cookable' ? (
              <StatusChip kind="cook" />
            ) : (
              <StatusChip kind="shop" missingCount={match.missing.length} />
            )}
          </div>
          <div className="rx-card-meta-overlay">
            serves {recipe.servings}
          </div>
        </div>
        <div className="rx-card-body">
          <div className="rx-card-title">{recipe.name}</div>
          {!dense && match.missing.length > 0 && (
            <div className="rx-card-need">
              need {match.missing.slice(0, 2).join(', ')}
              {match.missing.length > 2 ? ` & ${match.missing.length - 2} more` : ''}
            </div>
          )}
          <div className="rx-card-footer">
            <span>{recipe.ingredientCount} ingr</span>
          </div>
        </div>
      </button>
      {onSelect && (
        <button
          className={`rx-card-select-btn${selected ? ' rx-card-select-btn--active' : ''}`}
          onClick={e => { e.stopPropagation(); onSelect(); }}
          aria-label={selected ? 'Deselect recipe' : 'Select recipe'}
          aria-pressed={selected}
        >
          {selected ? '✓' : ''}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2.4: Add CSS for card wrapper and checkbox button**

In `apps/web/src/pages/RecipesPage/RecipesPage.css`, append after the last line:

```css
/* ── Selection ─────────────────────────────────────────────── */
.rx-card-wrapper {
  position: relative;
}

.rx-card-wrapper--selected .rx-card {
  border-color: var(--fresh);
  border-width: 2px;
}

.rx-card-select-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.28);
  color: var(--paper);
  font-size: 13px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  z-index: 3;
  transition: background 0.14s, border-color 0.14s;
}
.rx-card-select-btn:hover {
  background: rgba(0, 0, 0, 0.5);
}
.rx-card-select-btn--active {
  background: var(--fresh);
  border-color: var(--fresh);
}
.rx-card--dense .rx-card-select-btn {
  width: 22px;
  height: 22px;
  font-size: 11px;
}
```

- [ ] **Step 2.5: Run tests — expect PASS**

```bash
pnpm --filter @eat/web test -- --run RecipesPage
```

Expected: All 4 RecipeCard selection tests pass.

- [ ] **Step 2.6: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipesPage.tsx apps/web/src/pages/RecipesPage/RecipesPage.css apps/web/src/pages/RecipesPage/RecipesPage.test.tsx
git commit -m "feat: add checkbox selection to RecipeCard"
```

---

## Task 3: SelectionBar + selection state wired into RecipesPage

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.tsx`
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.css`

- [ ] **Step 3.1: Write failing tests for SelectionBar**

Add these tests to `apps/web/src/pages/RecipesPage/RecipesPage.test.tsx` (after the existing RecipeCard tests):

```tsx
import { SelectionBar } from './RecipesPage';

describe('SelectionBar', () => {
  const recipes = [
    { id: 'r1', name: 'Pasta', servings: 4, sourceImage: null, ingredientCount: 5, createdAt: '', updatedAt: '' },
    { id: 'r2', name: 'Pizza', servings: 2, sourceImage: null, ingredientCount: 3, createdAt: '', updatedAt: '' },
  ];

  it('is not visible when nothing is selected', () => {
    render(
      <SelectionBar
        selectedIds={new Set()}
        recipes={recipes}
        onClear={vi.fn()}
        onAddToPlan={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    const bar = document.querySelector('.rx-selection-bar');
    expect(bar).not.toHaveClass('rx-selection-bar--visible');
  });

  it('shows count when recipes are selected', () => {
    render(
      <SelectionBar
        selectedIds={new Set(['r1', 'r2'])}
        recipes={recipes}
        onClear={vi.fn()}
        onAddToPlan={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('calls onClear when × Clear is clicked', () => {
    const onClear = vi.fn();
    render(
      <SelectionBar
        selectedIds={new Set(['r1'])}
        recipes={recipes}
        onClear={onClear}
        onAddToPlan={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('× Clear'));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('shows inline confirmation when Delete is clicked', () => {
    render(
      <SelectionBar
        selectedIds={new Set(['r1'])}
        recipes={recipes}
        onClear={vi.fn()}
        onAddToPlan={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(screen.getByText(/can't be undone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onDelete and then onClear when Confirm delete is clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onClear = vi.fn();
    render(
      <SelectionBar
        selectedIds={new Set(['r1'])}
        recipes={recipes}
        onClear={onClear}
        onAddToPlan={vi.fn()}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    await waitFor(() => expect(onClear).toHaveBeenCalledOnce());
  });
});
```

Add `import { waitFor } from '@testing-library/react';` to the top of the test file.

- [ ] **Step 3.2: Run tests — expect FAIL**

```bash
pnpm --filter @eat/web test -- --run RecipesPage
```

Expected: SelectionBar tests fail — component not yet implemented.

- [ ] **Step 3.3: Add SelectionBar component to RecipesPage.tsx**

In `apps/web/src/pages/RecipesPage/RecipesPage.tsx`, add this export just before the `RecipesPage` function. It imports `useDeleteRecipe` from hooks and manages its own UI state:

```tsx
export function SelectionBar({
  selectedIds,
  recipes,
  onClear,
  onAddToPlan,
  onDelete,
}: {
  selectedIds: Set<string>;
  recipes: RecipeSummary[];
  onClear: () => void;
  onAddToPlan: () => Promise<{ addedTo: string[]; skipped: string[] }>;
  onDelete: () => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = selectedIds.size;

  async function handleAddToPlan() {
    setIsPending(true);
    setMessage(null);
    setError(null);
    try {
      const { addedTo, skipped } = await onAddToPlan();
      let msg = addedTo.length > 0 ? `Added to ${addedTo.join(', ')}` : 'No empty days found.';
      if (skipped.length > 0) {
        const skippedNames = skipped.map(id => recipes.find(r => r.id === id)?.name ?? id);
        msg += ` ${skipped.length} recipe${skipped.length > 1 ? 's' : ''} had no available day: ${skippedNames.join(', ')}.`;
      }
      setMessage(msg);
      setTimeout(() => { setMessage(null); onClear(); }, 3000);
    } catch {
      setError('Failed to add to plan. Try again.');
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteConfirm() {
    setIsPending(true);
    try {
      await onDelete();
      setConfirmDelete(false);
      onClear();
    } catch {
      setError('Some recipes could not be deleted. Try again.');
      setConfirmDelete(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div
      className={`rx-selection-bar${count > 0 ? ' rx-selection-bar--visible' : ''}`}
      aria-label="Selection actions"
    >
      {message ? (
        <span className="rx-selection-bar-message">{message}</span>
      ) : error ? (
        <>
          <span className="rx-selection-bar-error">{error}</span>
          <button className="rx-selection-bar-clear" onClick={() => setError(null)}>Dismiss</button>
        </>
      ) : confirmDelete ? (
        <>
          <span className="rx-selection-bar-count">
            Delete {count} recipe{count > 1 ? 's' : ''}? This can&apos;t be undone.
          </span>
          <button
            className="btn-primary rx-selection-bar-btn"
            onClick={handleDeleteConfirm}
            disabled={isPending}
            aria-label="Confirm"
          >
            {isPending ? 'Deleting…' : 'Confirm'}
          </button>
          <button
            className="btn-outline rx-selection-bar-btn"
            onClick={() => setConfirmDelete(false)}
            disabled={isPending}
            aria-label="Cancel"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="rx-selection-bar-count">{count} selected</span>
          <button className="rx-selection-bar-clear" onClick={onClear}>× Clear</button>
          <button
            className="btn-primary rx-selection-bar-btn"
            onClick={handleAddToPlan}
            disabled={isPending || count === 0}
          >
            {isPending ? 'Adding…' : 'Add to plan'}
          </button>
          <button
            className="rx-selection-bar-delete"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending || count === 0}
            aria-label="Delete"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3.4: Wire selection state into RecipesPage**

In `apps/web/src/pages/RecipesPage/RecipesPage.tsx`, make these changes to the `RecipesPage` function:

1. Add imports at the top of the file:
```tsx
import { useAddToNextEmptyDays } from '../../hooks/useMealPlan';
import { useDeleteRecipe } from '../../hooks/useRecipes';
```

2. Inside `RecipesPage`, add state and hook instances after the existing hooks:
```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const addToNextEmptyDays = useAddToNextEmptyDays();
const deleteRecipe = useDeleteRecipe();

function toggleSelection(id: string) {
  setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
}

function clearSelection() {
  setSelectedIds(new Set());
}

async function handleAddSelectedToPlan() {
  const items = [...selectedIds].map(id => {
    const recipe = recipes.find(r => r.id === id);
    return { recipeId: id, servings: recipe?.servings ?? 2 };
  });
  return addToNextEmptyDays.mutateAsync(items);
}

async function handleDeleteSelected() {
  await Promise.all([...selectedIds].map(id => deleteRecipe.mutateAsync(id)));
}
```

3. Pass `onAddToPlan` to `RecipeForm` in the modal render and add `SelectionBar` at the bottom of the returned JSX. Find the existing `RecipeForm` render (around line 302) and update it:
```tsx
{modal && modal.mode !== 'import' && (
  <RecipeForm
    mode={modal.mode}
    recipeId={modal.mode === 'edit' ? modal.id : undefined}
    onClose={() => setModal(null)}
    onAddToPlan={async (recipeId, servings) =>
      addToNextEmptyDays.mutateAsync([{ recipeId, servings }])
    }
  />
)}
```

4. Add `SelectionBar` just before the closing `</div>` of `recipes-page`:
```tsx
<SelectionBar
  selectedIds={selectedIds}
  recipes={recipes}
  onClear={clearSelection}
  onAddToPlan={handleAddSelectedToPlan}
  onDelete={handleDeleteSelected}
/>
```

5. Update every `<RecipeCard>` render to pass `selected` and `onSelect`:

Replace all occurrences of:
```tsx
<RecipeCard key={recipe.id} recipe={recipe} match={match} onOpen={() => setModal({ mode: 'edit', id: recipe.id })} />
```
with:
```tsx
<RecipeCard
  key={recipe.id}
  recipe={recipe}
  match={match}
  selected={selectedIds.has(recipe.id)}
  onSelect={() => toggleSelection(recipe.id)}
  onOpen={() => setModal({ mode: 'edit', id: recipe.id })}
/>
```

And the dense variant:
```tsx
<RecipeCard key={recipe.id} recipe={recipe} match={match} dense onOpen={() => setModal({ mode: 'edit', id: recipe.id })} />
```
becomes:
```tsx
<RecipeCard
  key={recipe.id}
  recipe={recipe}
  match={match}
  dense
  selected={selectedIds.has(recipe.id)}
  onSelect={() => toggleSelection(recipe.id)}
  onOpen={() => setModal({ mode: 'edit', id: recipe.id })}
/>
```

There are 4 `<RecipeCard>` render sites in the `'all'` tab sections (cookable, shoppable, library) and 1 in the filtered-tab `visible.map`. Update all 5.

- [ ] **Step 3.5: Add SelectionBar CSS**

In `apps/web/src/pages/RecipesPage/RecipesPage.css`, append after the selection styles added in Task 2:

```css
/* ── Selection bar ─────────────────────────────────────────── */
.rx-selection-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--ink);
  color: var(--paper);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  z-index: 200;
  transform: translateY(100%);
  transition: transform 0.2s ease;
}
.rx-selection-bar--visible {
  transform: translateY(0);
}
.rx-selection-bar-count {
  font-size: 14px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
}
.rx-selection-bar-message {
  font-size: 14px;
  flex: 1;
  color: var(--fresh);
}
.rx-selection-bar-error {
  font-size: 14px;
  flex: 1;
  color: var(--persimmon);
}
.rx-selection-bar-clear {
  background: none;
  border: none;
  color: rgba(243, 245, 242, 0.55);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  white-space: nowrap;
}
.rx-selection-bar-clear:hover { color: var(--paper); }
.rx-selection-bar-btn {
  white-space: nowrap;
  flex-shrink: 0;
}
.rx-selection-bar-delete {
  background: none;
  border: 1px solid rgba(243, 245, 242, 0.25);
  color: var(--paper);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  white-space: nowrap;
}
.rx-selection-bar-delete:hover { border-color: var(--persimmon); color: var(--persimmon); }
.rx-selection-bar-delete:disabled { opacity: 0.4; cursor: default; }
```

- [ ] **Step 3.6: Run tests — expect PASS**

```bash
pnpm --filter @eat/web test -- --run RecipesPage
```

Expected: All RecipeCard + SelectionBar tests pass.

- [ ] **Step 3.7: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipesPage.tsx apps/web/src/pages/RecipesPage/RecipesPage.css
git commit -m "feat: add SelectionBar and selection state to RecipesPage"
```

---

## Task 4: RecipeForm "Add to plan" button

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipeForm.tsx`

- [ ] **Step 4.1: Write failing tests**

Create `apps/web/src/pages/RecipesPage/RecipeForm.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { RecipeForm } from './RecipeForm';

vi.mock('../../hooks/useRecipes', () => ({
  useRecipe: vi.fn(() => ({
    data: {
      id: 'r1',
      name: 'Pasta',
      servings: 4,
      sourceUrl: null,
      sourceImage: null,
      instructions: null,
      ingredients: [
        { id: 'i1', canonicalFoodId: 'f1', foodName: 'Flour', qty: '200', unit: 'g', optional: false, sortOrder: 0 },
      ],
    },
    isLoading: false,
  })),
  useAddRecipe: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateRecipe: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('RecipeForm read-only view — Add to plan button', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders "Add to plan" button when onAddToPlan prop is provided', () => {
    render(
      <RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} onAddToPlan={vi.fn().mockResolvedValue({ addedTo: ['Mon 19 May'], skipped: [] })} />,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: /add to plan/i })).toBeInTheDocument();
  });

  it('does not render "Add to plan" button when onAddToPlan is not provided', () => {
    render(<RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} />, { wrapper });
    expect(screen.queryByRole('button', { name: /add to plan/i })).not.toBeInTheDocument();
  });

  it('calls onAddToPlan with recipeId and servings, then shows success label', async () => {
    const onAddToPlan = vi.fn().mockResolvedValue({ addedTo: ['Mon 19 May'], skipped: [] });
    render(
      <RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} onAddToPlan={onAddToPlan} />,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: /add to plan/i }));
    await waitFor(() => expect(onAddToPlan).toHaveBeenCalledWith('r1', 4));
    await waitFor(() => expect(screen.getByRole('button', { name: /mon 19 may/i })).toBeInTheDocument());
  });
});
```

- [ ] **Step 4.2: Run tests — expect FAIL**

```bash
pnpm --filter @eat/web test -- --run RecipeForm
```

Expected: Tests fail because `onAddToPlan` prop doesn't exist yet.

- [ ] **Step 4.3: Add onAddToPlan prop and button to RecipeForm**

In `apps/web/src/pages/RecipesPage/RecipeForm.tsx`:

1. Update the `RecipeFormProps` interface (currently at line 291):
```tsx
interface RecipeFormProps {
  mode: 'add' | 'edit';
  recipeId?: string;
  initialData?: ImportedRecipe;
  pendingPhoto?: { base64: string; mimeType: string };
  onClose: () => void;
  onAddToPlan?: (recipeId: string, servings: number) => Promise<{ addedTo: string[]; skipped: string[] }>;
}
```

2. Destructure the new prop in the function signature:
```tsx
export function RecipeForm({ mode, recipeId, initialData, pendingPhoto, onClose, onAddToPlan }: RecipeFormProps) {
```

3. Add two new state variables inside the function body (after the existing `const [readOnly, setReadOnly]` line):
```tsx
const [addToPlanStatus, setAddToPlanStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
const [addToPlanLabel, setAddToPlanLabel] = useState('Add to plan');
```

4. Replace the existing `<div className="form-actions">` block inside the `readOnly` branch (currently contains only `[Close]` and `[Edit]`) with:
```tsx
<div className="form-actions">
  <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
  {onAddToPlan && recipeId && (
    <button
      type="button"
      className="btn-secondary"
      disabled={addToPlanStatus === 'pending'}
      aria-label={addToPlanLabel}
      onClick={async () => {
        setAddToPlanStatus('pending');
        try {
          const { addedTo } = await onAddToPlan(recipeId, Number(servings));
          const label = addedTo[0] ? `Added to ${addedTo[0]}` : 'Added to plan';
          setAddToPlanLabel(label);
          setAddToPlanStatus('success');
          setTimeout(() => { setAddToPlanStatus('idle'); setAddToPlanLabel('Add to plan'); }, 2500);
        } catch {
          setAddToPlanLabel('Failed — try again');
          setAddToPlanStatus('error');
          setTimeout(() => { setAddToPlanStatus('idle'); setAddToPlanLabel('Add to plan'); }, 2500);
        }
      }}
    >
      {addToPlanStatus === 'pending' ? 'Adding…' : addToPlanLabel}
    </button>
  )}
  <button type="button" className="btn-primary" onClick={() => setReadOnly(false)}>Edit</button>
</div>
```

- [ ] **Step 4.4: Run tests — expect PASS**

```bash
pnpm --filter @eat/web test -- --run RecipeForm
```

Expected: All 3 RecipeForm tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipeForm.tsx apps/web/src/pages/RecipesPage/RecipeForm.test.tsx
git commit -m "feat: add 'Add to plan' button to RecipeForm read-only view"
```

---

## Task 5: Full test suite

- [ ] **Step 5.1: Run all unit tests**

```bash
pnpm test
```

Expected: All tests pass with no failures. If any unrelated tests are failing, investigate before proceeding — do not suppress.

- [ ] **Step 5.2: Run E2E tests**

```bash
pnpm test:e2e
```

Expected: All E2E tests pass.

- [ ] **Step 5.3: Final commit (if any lint/type fixes needed)**

If TypeScript or lint errors required fixes not captured above:
```bash
git add -p
git commit -m "fix: resolve type errors from recipe selection feature"
```
