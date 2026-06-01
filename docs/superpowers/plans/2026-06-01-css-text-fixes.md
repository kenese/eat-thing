# CSS & Text Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree:** Create an isolated worktree before starting — use the `superpowers:using-git-worktrees` skill.
>
> **Recommended model:** claude-haiku-4-5-20251001 (these are simple, targeted changes)

**Goal:** Fix three visual issues: instructions rendered in italic (font-loading bug), inconsistent button capitalisation, and the recipe modal fixed-width breaking layout.

**Architecture:** Three independent CSS/text changes: (1) add Lora regular weight to the font URL, (2) lowercase all button/inline-action text, (3) remove `min-width` on the modal panel and add `max-width` with responsive padding.

**Tech Stack:** HTML (index.html), CSS, React TSX. No new dependencies.

---

## File map

| File | Change |
|---|---|
| `apps/web/index.html` | Load Lora regular (non-italic) weight |
| `apps/web/src/pages/RecipesPage/RecipeForm.css` | `font-style: normal` on instructions + textarea; responsive modal width |
| `apps/web/src/pages/RecipesPage/RecipesPage.tsx` | Lowercase button labels |
| `apps/web/src/pages/RecipesPage/RecipeForm.tsx` | Lowercase button labels + dynamic label strings |
| `apps/web/src/pages/RecipesPage/ImportModal.tsx` | Lowercase tab labels + button labels |
| `apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx` | Lowercase menu button labels |

No tests needed — these are purely visual/text changes with no logic change.

---

## Task 1: Fix Lora font loading (italic bug)

**Files:**
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/pages/RecipesPage/RecipeForm.css`

The current font URL only loads Lora in italic weight (`ital,wght@1,400;1,500`). Any element using `--font-serif` without an explicit `font-style` renders italic. Fix: load both regular and italic.

- [ ] **Step 1: Update the Google Fonts URL in index.html**

Find this line:
```html
    href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;600;700;800&family=Lora:ital,wght@1,400;1,500&display=swap"
```
Replace with:
```html
    href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;600;700;800&family=Lora:ital,wght@0,400;0,500;1,400;1,500&display=swap"
```
The `0,400;0,500` adds the non-italic (upright) variants. The `1,400;1,500` italic variants stay so editorial italic text still works.

- [ ] **Step 2: Explicitly opt instructions and textarea out of italic**

In `apps/web/src/pages/RecipesPage/RecipeForm.css`, find `.recipe-view-instructions` and add `font-style: normal`:
```css
.recipe-view-instructions {
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.7;
  color: var(--ink);
  white-space: pre-wrap;
  font-style: normal;
}
```

Find `.form-textarea` and add `font-style: normal`:
```css
.form-textarea {
  width: 100%;
  min-height: 140px;
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: var(--radius-control);
  padding: 12px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
  font-weight: 400;
  font-style: normal;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/index.html apps/web/src/pages/RecipesPage/RecipeForm.css
git commit -m "fix: load Lora regular weight; instructions and textarea no longer italic"
```

---

## Task 2: Fix recipe modal width and layout

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipeForm.css`

The modal currently has `min-width: 960px` which breaks on small screens and makes the modal needlessly wide. Replace with `max-width` and fluid behaviour.

- [ ] **Step 1: Replace modal width rule**

Find this entire block in `RecipeForm.css`:
```css
@media (min-width: 600px) {
  .modal-panel--recipe {
    min-width: 960px;
  }
}
```
Replace with:
```css
.modal-panel--recipe {
  width: 100%;
  max-width: 760px;
}
```
This applies at all widths — `max-width` keeps it from being unreasonably wide on large screens, and `width: 100%` lets it compress naturally on mobile.

- [ ] **Step 2: Check for any other `.modal-panel` base styles**

Look in any shared modal CSS (search for `.modal-panel {` in the web src):
```bash
grep -rn "\.modal-panel\b" apps/web/src/ --include="*.css"
```
If there is a base `.modal-panel` definition with fixed `width` or `min-width`, make sure our override takes precedence. No changes expected; verify only.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipeForm.css
git commit -m "fix: replace modal min-width with responsive max-width"
```

---

## Task 3: Lowercase button and action labels — RecipesPage.tsx

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.tsx`

Design decision: editorial all-lowercase for all button and inline-action text. Page titles (`h1`, `h2`) and modal headers stay sentence case.

- [ ] **Step 1: Update SelectionBar button labels**

Find and replace these exact strings inside `RecipesPage.tsx`:

| Old | New |
|---|---|
| `'Deleting…'` | `'deleting…'` |
| `'Confirm'` (button label after confirmDelete) | `'confirm'` |
| `'Cancel'` (button in SelectionBar) | `'cancel'` |
| `'× Clear'` | `'× clear'` |
| `'Adding…'` (in handleAddToPlan button) | `'adding…'` |
| `'Add to plan'` (SelectionBar button) | `'add to plan'` |
| `'Delete'` (SelectionBar delete button) | `'delete'` |

- [ ] **Step 2: Update PageTitle action buttons**

Find:
```tsx
<button className="btn-outline" onClick={() => setModal({ mode: 'import' })}>↓ Import</button>
```
Change to:
```tsx
<button className="btn-outline" onClick={() => setModal({ mode: 'import' })}>↓ import</button>
```
The `+ new recipe` button is already lowercase — leave it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipesPage.tsx
git commit -m "style: lowercase button labels in RecipesPage"
```

---

## Task 4: Lowercase button labels — RecipeForm.tsx

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipeForm.tsx`

- [ ] **Step 1: Lowercase the add-to-plan label state and its updates**

Find:
```tsx
const [addToPlanLabel, setAddToPlanLabel] = useState('Add to plan');
```
Change to:
```tsx
const [addToPlanLabel, setAddToPlanLabel] = useState('add to plan');
```

Find inside the click handler:
```tsx
const label = addedTo[0] ? `Added to ${addedTo[0]}` : 'Added to plan';
```
Change to:
```tsx
const label = addedTo[0] ? `added to ${addedTo[0]}` : 'added to plan';
```

Find:
```tsx
setAddToPlanLabel('Failed — try again');
```
Change to:
```tsx
setAddToPlanLabel('failed — try again');
```

- [ ] **Step 2: Lowercase the "Adding…" spinner text**

Find inside the add-to-plan button:
```tsx
{addToPlanStatus === 'pending' ? 'Adding…' : addToPlanLabel}
```
Change to:
```tsx
{addToPlanStatus === 'pending' ? 'adding…' : addToPlanLabel}
```

- [ ] **Step 3: Lowercase all other action buttons in the read-only view and form**

Find and change these exact button label strings (use search, there are multiple occurrences):

| Old text | New text |
|---|---|
| `>Close<` (the close button in read-only form-actions) | `>close<` |
| `>Edit<` | `>edit<` |
| `>Cancel<` | `>cancel<` |
| `'Saving…'` | `'saving…'` |
| `'Save imported recipe'` | `'save imported recipe'` |
| `'Add recipe'` (submit button label, NOT the modal h2) | `'add recipe'` |
| `'Save changes'` | `'save changes'` |

Be careful: `'Add recipe'` appears both as the `h2` title and as a button label. Only change the button label. The h2 line looks like:
```tsx
<h2>{initialData ? 'Review imported recipe' : mode === 'add' ? 'Add recipe' : name || 'Recipe'}</h2>
```
Do NOT change the h2 content. Change only the submit button:
```tsx
{isPending ? 'saving…' : initialData ? 'save imported recipe' : mode === 'add' ? 'add recipe' : 'save changes'}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipeForm.tsx
git commit -m "style: lowercase button labels in RecipeForm"
```

---

## Task 5: Lowercase labels — ImportModal.tsx and RecipeImagePicker.tsx

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/ImportModal.tsx`
- Modify: `apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx`

- [ ] **Step 1: Update ImportModal tab labels and button text**

In `ImportModal.tsx`, find the tab label rendering:
```tsx
{t === 'url'
  ? 'URL'
  : t === 'photo'
    ? 'Photo'
    : t === 'search'
      ? 'Search'
      : 'Meal Planner'}
```
Change to:
```tsx
{t === 'url'
  ? 'URL'
  : t === 'photo'
    ? 'photo'
    : t === 'search'
      ? 'search'
      : 'meal planner'}
```
`URL` stays uppercase as it is an acronym.

Find and replace these button label strings in `ImportModal.tsx`:

| Old | New |
|---|---|
| `'Extracting…'` | `'extracting…'` |
| `'Extract recipe'` | `'extract recipe'` |
| `'Importing…'` | `'importing…'` |
| `'Import'` (the button inside the mealPlanner list items) | `'import'` |
| `'Searching…'` | `'searching…'` |
| `'Search'` (submit button, not the tab label which is handled above) | `'search'` |
| `'Use this'` | `'use this'` |

- [ ] **Step 2: Update RecipeImagePicker menu button labels**

In `RecipeImagePicker.tsx`, find and replace:

| Old | New |
|---|---|
| `Remove photo` | `remove photo` |
| `Paste from clipboard` | `paste from clipboard` |
| `Choose file` | `choose file` |
| `Enter URL` | `enter URL` |
| `Cancel` (in the image menu) | `cancel` |
| `'Loading…'` | `'loading…'` |
| `'Load image'` | `'load image'` |
| `Back` | `back` |
| `Add photo` (the placeholder label span) | `add photo` |

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/RecipesPage/ImportModal.tsx apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx
git commit -m "style: lowercase button and menu labels in ImportModal and RecipeImagePicker"
```

---

## Self-review checklist

After all tasks:
- [ ] Run `pnpm --filter @eat/web test` — all existing tests must pass (text content changes may break snapshot tests if any exist; update them).
- [ ] Visually verify: open the app, check instructions are no longer italic, modal resizes properly on narrow viewport, all button labels are lowercase.
