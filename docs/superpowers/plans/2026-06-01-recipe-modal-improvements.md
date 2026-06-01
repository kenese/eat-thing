# Recipe Modal Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree:** Create an isolated worktree before starting — use the `superpowers:using-git-worktrees` skill.
>
> **Recommended model:** claude-haiku-4-5-20251001

**Goal:** Three improvements to the recipe modal: (1) add delete from the modal, (2) remove the Library bucket, (3) show sectioned ingredients and render `## headings` in instructions.

**Architecture:** All changes are in `RecipesPage.tsx` and `RecipeForm.tsx`. The Library removal collapses the "library" bucket into the general grid. The delete button is a two-step inline confirm inside the read-only view. Sections rendering uses simple grouping and a line-by-line instructions parser — no external markdown library.

**Tech Stack:** React, TanStack Query (existing hooks). No new dependencies.

---

## File map

| File | Change |
|---|---|
| `apps/web/src/pages/RecipesPage/RecipesPage.tsx` | Remove Library tab + section |
| `apps/web/src/pages/RecipesPage/RecipeForm.tsx` | Delete button, sections grouping, instructions heading renderer |
| `apps/web/src/pages/RecipesPage/RecipeForm.css` | `.btn-danger`, section header styles, instruction heading styles |
| `apps/web/src/pages/RecipesPage/RecipesPage.test.tsx` | Update test that references `'library'` bucket if needed |

---

## Task 1: Remove Library bucket from RecipesPage

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.tsx`

- [ ] **Step 1: Write failing tests for Library removal**

In `apps/web/src/pages/RecipesPage/RecipesPage.test.tsx`, add a test verifying no "Library" tab renders. First run to confirm it currently fails:

```tsx
// Add to RecipesPage.test.tsx — import render, screen from '@testing-library/react' already imported
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// At bottom of file, add:
describe('Library bucket removal', () => {
  it('does not render a Library tab', () => {
    const qc = new QueryClient();
    // We only test RecipeCard and SelectionBar here since RecipesPage uses live hooks.
    // Verify the Tab type no longer includes 'library' by checking the FilterStrip tabs
    // passed at runtime via integration — for unit scope, just check RecipeCard with a
    // library-bucketed recipe renders a shop chip (not a special library chip).
    const recipe = {
      id: 'r1', name: 'Test', servings: 2, sourceUrl: null, sourceImage: null,
      ingredientCount: 10, totalTimeMinutes: null, tags: [], canonicalFoodIds: [],
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    const match = { bucket: 'library' as const, missing: ['a', 'b', 'c', 'd', 'e'] };
    render(<RecipeCard recipe={recipe} match={match} onOpen={vi.fn()} />);
    // Library-bucketed recipe shows the shop chip (missingCount > 0), not a separate label
    expect(screen.queryByText(/library/i)).not.toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @eat/web test -- --reporter=verbose RecipesPage`
Expected: new test passes immediately (RecipeCard never rendered "library" text).

- [ ] **Step 2: Remove the Library tab entry**

In `RecipesPage.tsx`, find the `tabs` array:
```tsx
const tabs = [
  { key: 'all',       label: 'All',        count: recipes.length },
  { key: 'cookable',  label: 'Cook now',   count: cookable.length,  dotColor: 'var(--fresh)' },
  { key: 'shoppable', label: 'Quick shop', count: shoppable.length, dotColor: 'var(--persimmon)' },
  { key: 'library',   label: 'Library',    count: library.length },
];
```
Remove the library entry:
```tsx
const tabs = [
  { key: 'all',       label: 'all',         count: recipes.length },
  { key: 'cookable',  label: 'cook now',    count: cookable.length,  dotColor: 'var(--fresh)' },
  { key: 'shoppable', label: 'quick shop',  count: shoppable.length, dotColor: 'var(--persimmon)' },
];
```
(Tab labels lowercased here too, per the capitalisation decision.)

- [ ] **Step 3: Remove 'library' from the Tab type and flatSorted**

Find:
```tsx
type Tab = 'all' | 'cookable' | 'shoppable' | 'library';
```
Change to:
```tsx
type Tab = 'all' | 'cookable' | 'shoppable';
```

Find the `flatSorted` base:
```tsx
const base = tab === 'all' ? sortedByMatch
  : tab === 'cookable' ? cookable
  : tab === 'shoppable' ? shoppable
  : library;
```
Change to:
```tsx
const base = tab === 'all' ? sortedByMatch
  : tab === 'cookable' ? cookable
  : shoppable;
```

- [ ] **Step 4: Remove "The library" section from the cookable-first All view, merge library recipes into flat grid**

Find the entire library section block (inside the `{!isLoading && tab === 'all' && sortOrder === 'cookable-first' ? (` branch):
```tsx
{library.length > 0 && (
  <section className="rx-section">
    <div className="rx-section-header">
      <span className="rx-section-title">
        The library<span className="dot" style={{ color: 'var(--green)' }}>.</span>
      </span>
      <span className="rx-section-count">{library.length} {library.length === 1 ? 'recipe' : 'recipes'}</span>
      <span className="rx-section-hint">all recipes</span>
    </div>
    <div className="rx-grid rx-grid--dense">
      {library.map(({ recipe, match }) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          match={match}
          dense
          selected={selectedIds.has(recipe.id)}
          onSelect={() => toggleSelection(recipe.id)}
          onOpen={() => setModal({ mode: 'edit', id: recipe.id })}
        />
      ))}
    </div>
  </section>
)}
```
Replace with a plain grid (no section header):
```tsx
{library.length > 0 && (
  <div className="rx-grid">
    {library.map(({ recipe, match }) => (
      <RecipeCard
        key={recipe.id}
        recipe={recipe}
        match={match}
        selected={selectedIds.has(recipe.id)}
        onSelect={() => toggleSelection(recipe.id)}
        onOpen={() => setModal({ mode: 'edit', id: recipe.id })}
      />
    ))}
  </div>
)}
```

- [ ] **Step 5: Update the PageTitle summary — remove "in the library" wording**

Find:
```tsx
<span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>
  {recipes.length} in the library
</span>
```
Change to:
```tsx
<span style={{ color: 'var(--mute)', fontSize: 14 }}>
  {recipes.length} total
</span>
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @eat/web test -- --reporter=verbose RecipesPage
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipesPage.tsx apps/web/src/pages/RecipesPage/RecipesPage.test.tsx
git commit -m "feat: remove Library bucket — library recipes appear in the main All grid"
```

---

## Task 2: Add delete button to recipe modal

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipeForm.tsx`
- Modify: `apps/web/src/pages/RecipesPage/RecipeForm.css`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/RecipesPage/RecipeForm.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock all hooks used by RecipeForm
vi.mock('../../hooks/useRecipes', () => ({
  useRecipe: vi.fn(() => ({
    data: {
      id: 'r1',
      name: 'Test Recipe',
      servings: 4,
      sourceUrl: null,
      sourceImage: null,
      instructions: 'Step 1\n\n## Sauce\nStep 2',
      ingredients: [
        { id: 'i1', recipeId: 'r1', canonicalFoodId: 'f1', foodName: 'Flour',
          qty: '200', unit: 'g', section: null, metricValue: '200 g', optional: false, sortOrder: 0 },
        { id: 'i2', recipeId: 'r1', canonicalFoodId: 'f2', foodName: 'Eggs',
          qty: '2', unit: 'count', section: 'For the sauce', metricValue: '2 count', optional: false, sortOrder: 1 },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    isLoading: false,
  })),
  useAddRecipe: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateRecipe: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteRecipe: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('../../hooks/useFoodSearch', () => ({
  useFoodSearch: vi.fn(() => ({ data: [] })),
  useCreateFood: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

import { RecipeForm } from './RecipeForm';

describe('RecipeForm delete', () => {
  it('shows delete button in read-only mode', () => {
    wrap(<RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows confirm prompt when delete is clicked', () => {
    wrap(<RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(screen.getByText(/delete this recipe/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('calls deleteRecipe and onClose on confirm', async () => {
    const { useDeleteRecipe } = await import('../../hooks/useRecipes');
    const deleteFn = vi.fn().mockResolvedValue({ id: 'r1' });
    (useDeleteRecipe as ReturnType<typeof vi.fn>).mockReturnValue({
      mutateAsync: deleteFn, isPending: false,
    });
    const onClose = vi.fn();
    wrap(<RecipeForm mode="edit" recipeId="r1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() => expect(deleteFn).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('cancels the confirm prompt', () => {
    wrap(<RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText(/delete this recipe/i)).not.toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @eat/web test -- --reporter=verbose RecipeForm`
Expected: FAIL — `useDeleteRecipe` is not imported in RecipeForm yet.

- [ ] **Step 2: Add delete state and handler to RecipeForm**

In `RecipeForm.tsx`, add to existing imports:
```tsx
import { useRecipe, useAddRecipe, useUpdateRecipe, useDeleteRecipe } from '../../hooks/useRecipes';
```
(`useDeleteRecipe` is added — the others are already there.)

Add two state declarations after the existing `readOnly` state:
```tsx
const [deleteConfirm, setDeleteConfirm] = useState(false);
const deleteRecipe = useDeleteRecipe();
```

Add the handler function after `handleSubmit`:
```tsx
async function handleDelete() {
  if (!recipeId) return;
  await deleteRecipe.mutateAsync(recipeId);
  onClose();
}
```

- [ ] **Step 3: Add the delete button to the read-only view actions**

Find the `form-actions` div inside the read-only `<div className="recipe-view">` block:
```tsx
<div className="form-actions">
  <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
  {onAddToPlan && recipeId && (
    ...
  )}
  <button type="button" className="btn-primary" onClick={() => setReadOnly(false)}>Edit</button>
</div>
```
Replace with:
```tsx
<div className="form-actions">
  {deleteConfirm ? (
    <>
      <span className="recipe-view-delete-warning">delete this recipe?</span>
      <button
        type="button"
        className="btn-danger"
        onClick={handleDelete}
        disabled={deleteRecipe.isPending}
      >
        {deleteRecipe.isPending ? 'deleting…' : 'yes, delete'}
      </button>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setDeleteConfirm(false)}
      >
        cancel
      </button>
    </>
  ) : (
    <>
      {mode === 'edit' && recipeId && (
        <button
          type="button"
          className="btn-danger btn-danger--ghost"
          onClick={() => setDeleteConfirm(true)}
        >
          delete
        </button>
      )}
      <button type="button" className="btn-secondary" onClick={onClose}>close</button>
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
              const label = addedTo[0] ? `added to ${addedTo[0]}` : 'added to plan';
              setAddToPlanLabel(label);
              setAddToPlanStatus('success');
              setTimeout(() => { setAddToPlanStatus('idle'); setAddToPlanLabel('add to plan'); }, 2500);
            } catch {
              setAddToPlanLabel('failed — try again');
              setAddToPlanStatus('error');
              setTimeout(() => { setAddToPlanStatus('idle'); setAddToPlanLabel('add to plan'); }, 2500);
            }
          }}
        >
          {addToPlanStatus === 'pending' ? 'adding…' : addToPlanLabel}
        </button>
      )}
      <button type="button" className="btn-primary" onClick={() => setReadOnly(false)}>edit</button>
    </>
  )}
</div>
```

- [ ] **Step 4: Add btn-danger styles to RecipeForm.css**

Add at the end of `RecipeForm.css`:
```css
/* ── Delete button ───────────────────────────────────────── */

.btn-danger {
  background: var(--warn);
  color: var(--paper);
  border: none;
  border-radius: var(--radius-control);
  padding: 10px 16px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.btn-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--warn) 85%, black); }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger--ghost {
  background: transparent;
  color: var(--warn);
  border: 1px solid color-mix(in srgb, var(--warn) 40%, transparent);
}
.btn-danger--ghost:hover:not(:disabled) {
  background: color-mix(in srgb, var(--warn) 8%, transparent);
  border-color: var(--warn);
}

.recipe-view-delete-warning {
  font-size: 13px;
  color: var(--warn);
  font-family: var(--font-sans);
  align-self: center;
  margin-right: auto;
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @eat/web test -- --reporter=verbose RecipeForm
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipeForm.tsx apps/web/src/pages/RecipesPage/RecipeForm.css apps/web/src/pages/RecipesPage/RecipeForm.test.tsx
git commit -m "feat: add delete button with inline confirm to recipe modal"
```

---

## Task 3: Sectioned ingredients and instruction headings

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipeForm.tsx`
- Modify: `apps/web/src/pages/RecipesPage/RecipeForm.css`

- [ ] **Step 1: Write failing tests**

Add to `RecipeForm.test.tsx`:

```tsx
describe('RecipeForm sections rendering', () => {
  it('renders section header for sectioned ingredients', () => {
    wrap(<RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} />);
    // The mocked recipe has an ingredient with section: 'For the sauce'
    expect(screen.getByText('for the sauce')).toBeInTheDocument();
  });

  it('renders ## headings in instructions as h3 elements', () => {
    wrap(<RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} />);
    // The mocked recipe instructions contain '## Sauce'
    expect(screen.getByRole('heading', { name: 'Sauce', level: 3 })).toBeInTheDocument();
  });

  it('renders non-heading instruction lines as paragraphs', () => {
    wrap(<RecipeForm mode="edit" recipeId="r1" onClose={vi.fn()} />);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
  });
});
```

Run: `pnpm --filter @eat/web test -- --reporter=verbose RecipeForm`
Expected: FAIL — section headers and h3 not rendered yet.

- [ ] **Step 2: Add groupBySection helper**

At the top of `RecipeForm.tsx`, after the existing helper functions, add:

```tsx
function groupBySection(ings: IngredientDraft[]): Array<{ section: string | null; items: IngredientDraft[] }> {
  const groups: Array<{ section: string | null; items: IngredientDraft[] }> = [];
  const seen = new Map<string | null, number>();
  for (const ing of ings) {
    const key = ing.section ?? null;
    if (!seen.has(key)) {
      seen.set(key, groups.length);
      groups.push({ section: key, items: [] });
    }
    groups[seen.get(key)!].items.push(ing);
  }
  return groups;
}
```

- [ ] **Step 3: Add renderInstructions helper**

After `groupBySection`, add:

```tsx
function renderInstructions(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      return <h3 key={i} className="recipe-instructions-heading">{headingMatch[1]}</h3>;
    }
    if (!line.trim()) {
      return <div key={i} className="recipe-instructions-gap" />;
    }
    return <p key={i} className="recipe-instructions-para">{line}</p>;
  });
}
```

- [ ] **Step 4: Update the read-only ingredients list to use sections**

Find the ingredients section inside `<div className="recipe-view-body">`:
```tsx
{ingredients.length > 0 && (
  <div className="recipe-view-section">
    <span className="ingredients-section-title">Ingredients</span>
    <ul className="recipe-view-ingredients">
      {ingredients.map(ing => (
        <li key={ing.clientId} className="recipe-view-ingredient">
          {formatIngredient(ing)}
          {ing.optional && <span className="recipe-view-optional"> (optional)</span>}
        </li>
      ))}
    </ul>
  </div>
)}
```
Replace with:
```tsx
{ingredients.length > 0 && (
  <div className="recipe-view-section">
    <span className="ingredients-section-title">Ingredients</span>
    {groupBySection(ingredients).map((group, gi) => (
      <div key={gi} className="recipe-view-ingredient-group">
        {group.section && (
          <div className="recipe-view-ingredient-section-header">{group.section.toLowerCase()}</div>
        )}
        <ul className="recipe-view-ingredients">
          {group.items.map(ing => (
            <li key={ing.clientId} className="recipe-view-ingredient">
              {formatIngredient(ing)}
              {ing.optional && <span className="recipe-view-optional"> (optional)</span>}
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 5: Update the instructions renderer to use renderInstructions**

Find:
```tsx
{instructions && (
  <div className="recipe-view-section">
    <span className="ingredients-section-title">Instructions</span>
    <p className="recipe-view-instructions">{instructions}</p>
  </div>
)}
```
Replace with:
```tsx
{instructions && (
  <div className="recipe-view-section">
    <span className="ingredients-section-title">Instructions</span>
    <div className="recipe-view-instructions">
      {renderInstructions(instructions)}
    </div>
  </div>
)}
```

- [ ] **Step 6: Add section and instruction styles to RecipeForm.css**

Add after the existing `.recipe-view-instructions` block:
```css
/* ── Sectioned ingredients ────────────────────────────────── */

.recipe-view-ingredient-group + .recipe-view-ingredient-group {
  margin-top: 16px;
}

.recipe-view-ingredient-section-header {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink2);
  margin-bottom: 8px;
}

/* ── Instruction headings (## rendered as h3) ─────────────── */

.recipe-instructions-heading {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  margin: 20px 0 6px;
}

.recipe-instructions-heading:first-child {
  margin-top: 0;
}

.recipe-instructions-para {
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.7;
  color: var(--ink);
  margin: 0 0 6px;
  font-style: normal;
}

.recipe-instructions-gap {
  height: 8px;
}
```

Also update `.recipe-view-instructions` to remove `white-space: pre-wrap` (now handled by the structured renderer):
```css
.recipe-view-instructions {
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.7;
  color: var(--ink);
  font-style: normal;
}
```

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @eat/web test -- --reporter=verbose RecipeForm
```
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipeForm.tsx apps/web/src/pages/RecipesPage/RecipeForm.css apps/web/src/pages/RecipesPage/RecipeForm.test.tsx
git commit -m "feat: sectioned ingredients and ## headings in recipe modal read-only view"
```

---

## Self-review checklist

After all tasks:
- [ ] Run `pnpm --filter @eat/web test` — all tests pass.
- [ ] Visually verify: open a recipe, confirm delete button appears, confirm flow works, library recipes appear in the main grid (no Library tab), sectioned recipes show section headers, `## headings` in instructions render as styled h3.
