# Recipe Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the RecipeForm modal with proper CSS, 680px width, image picker, two-zone layout, and a 2-column ingredient grid on desktop.

**Architecture:** Create a new `RecipeForm.css` co-located with the component for all recipe-specific styles (using real design tokens from `tokens.css`). Extract image-picking logic into a focused `RecipeImagePicker` component. Update `RecipeForm.tsx` to wire in new layout, photo state, and ingredient grid.

**Tech Stack:** React, TypeScript, plain CSS (CSS custom properties), Vitest, React Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/web/src/pages/InventoryPage/ItemForm.css` | Modify | Widen modal to 680px |
| `apps/web/src/pages/RecipesPage/RecipeForm.css` | **Create** | All recipe-form-specific styles |
| `apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx` | **Create** | Image box UI + clipboard/file/URL logic |
| `apps/web/src/pages/RecipesPage/RecipeImagePicker.test.tsx` | **Create** | Unit tests for picker behaviour |
| `apps/web/src/pages/RecipesPage/RecipeForm.tsx` | Modify | Import new CSS, photo state, updated layout and ingredient grid |

---

## Task 1: Widen the modal

**Files:**
- Modify: `apps/web/src/pages/InventoryPage/ItemForm.css:27-34`

- [ ] **Step 1: Change max-width on `.modal-panel`**

In `apps/web/src/pages/InventoryPage/ItemForm.css`, find the `@media (min-width: 600px)` block for `.modal-panel` (lines 27–34) and change `max-width`:

```css
@media (min-width: 600px) {
  .modal-panel {
    max-width: 680px;
    border-radius: 16px;
    border-top: 1px solid var(--border);
    max-height: 90vh;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/InventoryPage/ItemForm.css
git commit -m "style: widen recipe modal to 680px on desktop"
```

---

## Task 2: Create RecipeForm.css

**Files:**
- Create: `apps/web/src/pages/RecipesPage/RecipeForm.css`

No behaviour — purely visual. No tests required.

- [ ] **Step 1: Create the file with all recipe-form styles**

Create `apps/web/src/pages/RecipesPage/RecipeForm.css` with the following content:

```css
/* ── Form shell ──────────────────────────────────────────── */

.recipe-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 24px 24px;
}

/* ── Metadata + image header ─────────────────────────────── */

.recipe-form-header {
  display: grid;
  grid-template-columns: 1fr 180px;
  gap: 16px;
  align-items: start;
}

.recipe-form-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 600px) {
  .recipe-form-header {
    grid-template-columns: 1fr;
  }
}

/* ── Image box ───────────────────────────────────────────── */

.recipe-image-box {
  position: relative;
  width: 100%;
  height: 180px;
  border-radius: var(--radius-card);
  background: var(--paper2);
  border: 1.5px dashed rgba(13, 23, 20, 0.2);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.recipe-image-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.recipe-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--mute);
  pointer-events: none;
}

.recipe-image-placeholder-icon {
  font-size: 28px;
  color: var(--persimmon);
  line-height: 1;
  font-weight: 300;
}

.recipe-image-placeholder-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.recipe-image-menu {
  position: absolute;
  inset: 0;
  background: rgba(13, 23, 20, 0.88);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 4px;
  padding: 12px;
}

.recipe-image-menu-btn {
  background: rgba(243, 245, 242, 0.1);
  border: 1px solid rgba(243, 245, 242, 0.18);
  color: var(--paper);
  border-radius: var(--radius-control);
  padding: 8px 12px;
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.recipe-image-menu-btn:hover {
  background: rgba(243, 245, 242, 0.2);
}

.recipe-image-menu-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.recipe-image-url-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.recipe-image-url-input {
  background: rgba(243, 245, 242, 0.1);
  border: 1px solid rgba(243, 245, 242, 0.3);
  color: var(--paper);
  border-radius: var(--radius-control);
  padding: 8px 10px;
  font-size: 13px;
  font-family: var(--font-sans);
  width: 100%;
}

.recipe-image-url-input::placeholder {
  color: rgba(243, 245, 242, 0.4);
}

.recipe-image-error {
  color: var(--paper);
  font-size: 11px;
  margin: 2px 0 0;
  opacity: 0.8;
}

/* ── Divider ─────────────────────────────────────────────── */

.recipe-form-divider {
  height: 1px;
  background: var(--rule);
  border: none;
  margin: 0 -24px;
}

/* ── Ingredients ─────────────────────────────────────────── */

.ingredients-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ingredients-section-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.ingredients-section-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 22px;
  color: var(--ink);
}

.ingredients-section-count {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  color: var(--mute);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.ingredients-block {
  background: var(--paper2);
  border-radius: var(--radius-card);
  overflow: hidden;
}

.ingredients-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  list-style: none;
}

@media (max-width: 600px) {
  .ingredients-grid {
    grid-template-columns: 1fr;
  }
}

.ingredient-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--rule2);
}

/* Remove bottom border from last row on desktop (last item and second-to-last if odd position) */
.ingredient-row:last-child {
  border-bottom: none;
}

.ingredient-row:nth-last-child(2):nth-child(odd) {
  border-bottom: none;
}

@media (max-width: 600px) {
  .ingredient-row:nth-last-child(2):nth-child(odd) {
    border-bottom: 1px solid var(--rule2);
  }
}

.ingredient-name {
  flex: 1;
  font-family: var(--font-sans);
  font-size: 15px;
  color: var(--ink);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ingredient-row--unmatched .ingredient-name {
  color: var(--persimmon);
}

.ingredient-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ingredient-qty {
  width: 56px;
  padding: 6px 8px !important;
  font-size: 13px !important;
}

.ingredient-unit {
  width: 72px;
  padding: 6px 8px !important;
  font-size: 13px !important;
}

.ingredient-remove {
  background: none;
  border: none;
  color: var(--ink3);
  cursor: pointer;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: var(--radius-control);
  transition: color 0.1s;
  line-height: 1;
}

.ingredient-remove:hover {
  color: var(--warn);
}

/* ── Instructions ────────────────────────────────────────── */

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
}

.form-textarea:focus {
  outline: none;
  border-color: var(--persimmon);
}

.form-textarea::placeholder {
  color: var(--mute);
  font-style: italic;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipeForm.css
git commit -m "style: add RecipeForm.css with recipe-specific layout and design tokens"
```

---

## Task 3: RecipeImagePicker component (TDD)

**Files:**
- Create: `apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx`
- Create: `apps/web/src/pages/RecipesPage/RecipeImagePicker.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/pages/RecipesPage/RecipeImagePicker.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecipeImagePicker, blobToBase64 } from './RecipeImagePicker';

describe('RecipeImagePicker', () => {
  it('shows placeholder when no photo', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    expect(screen.getByText('Add photo')).toBeInTheDocument();
  });

  it('shows image when photo is provided', () => {
    render(<RecipeImagePicker photoBase64="abc123" photoMimeType="image/jpeg" onChange={vi.fn()} />);
    const img = screen.getByAltText('Recipe');
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,abc123');
  });

  it('opens option menu on click when no photo', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Add photo').closest('.recipe-image-box')!);
    expect(screen.getByText('Paste from clipboard')).toBeInTheDocument();
    expect(screen.getByText('Choose file')).toBeInTheDocument();
    expect(screen.getByText('Enter URL')).toBeInTheDocument();
  });

  it('shows Remove option when photo is present', () => {
    render(<RecipeImagePicker photoBase64="abc" photoMimeType="image/jpeg" onChange={vi.fn()} />);
    fireEvent.click(screen.getByAltText('Recipe').closest('.recipe-image-box')!);
    expect(screen.getByText('Remove photo')).toBeInTheDocument();
  });

  it('calls onChange(null, null) when Remove photo clicked', () => {
    const onChange = vi.fn();
    render(<RecipeImagePicker photoBase64="abc" photoMimeType="image/jpeg" onChange={onChange} />);
    fireEvent.click(screen.getByAltText('Recipe').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('Remove photo'));
    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('reveals URL input after clicking Enter URL', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Add photo').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('Enter URL'));
    expect(screen.getByPlaceholderText('https://example.com/image.jpg')).toBeInTheDocument();
  });

  it('closes menu when Cancel is clicked', () => {
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Add photo').closest('.recipe-image-box')!);
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Paste from clipboard')).not.toBeInTheDocument();
  });
});

describe('blobToBase64', () => {
  it('converts a blob to a base64 string without the data-URI prefix', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const result = await blobToBase64(blob);
    expect(result).toBe('aGVsbG8=');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd apps/web && pnpm vitest run src/pages/RecipesPage/RecipeImagePicker.test.tsx
```

Expected: `FAIL` — `RecipeImagePicker` not found.

- [ ] **Step 3: Implement RecipeImagePicker**

Create `apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx`:

```tsx
import React, { useRef, useState } from 'react';

interface RecipeImagePickerProps {
  photoBase64: string | null;
  photoMimeType: string | null;
  onChange: (base64: string | null, mimeType: string | null) => void;
}

type MenuState = 'closed' | 'options' | 'url-input' | 'loading';

export function RecipeImagePicker({ photoBase64, photoMimeType, onChange }: RecipeImagePickerProps) {
  const [menuState, setMenuState] = useState<MenuState>('closed');
  const [urlInput, setUrlInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasPhoto = !!photoBase64;

  function openMenu() {
    setMenuState('options');
    setErrorMsg('');
  }

  function closeMenu() {
    setMenuState('closed');
    setUrlInput('');
    setErrorMsg('');
  }

  async function handlePaste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const base64 = await blobToBase64(blob);
          onChange(base64, imageType);
          closeMenu();
          return;
        }
      }
      setErrorMsg('No image found on clipboard.');
    } catch {
      setErrorMsg('Clipboard access denied.');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const mimeType = dataUrl.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
      const base64 = dataUrl.split(',')[1];
      onChange(base64, mimeType);
      closeMenu();
    };
    reader.readAsDataURL(file);
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url) return;
    setMenuState('loading');
    setErrorMsg('');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('URL did not return an image.');
      const base64 = await blobToBase64(blob);
      onChange(base64, blob.type);
      closeMenu();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load image.');
      setMenuState('url-input');
    }
  }

  return (
    <div
      className="recipe-image-box"
      onClick={menuState === 'closed' ? openMenu : undefined}
    >
      {hasPhoto ? (
        <img src={`data:${photoMimeType};base64,${photoBase64}`} alt="Recipe" />
      ) : (
        <div className="recipe-image-placeholder">
          <span className="recipe-image-placeholder-icon">+</span>
          <span className="recipe-image-placeholder-label">Add photo</span>
        </div>
      )}

      {menuState !== 'closed' && (
        <div className="recipe-image-menu" onClick={e => e.stopPropagation()}>
          {menuState === 'options' && (
            <>
              {hasPhoto && (
                <button type="button" className="recipe-image-menu-btn" onClick={() => { onChange(null, null); closeMenu(); }}>
                  Remove photo
                </button>
              )}
              <button type="button" className="recipe-image-menu-btn" onClick={handlePaste}>
                Paste from clipboard
              </button>
              <button type="button" className="recipe-image-menu-btn" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </button>
              <button type="button" className="recipe-image-menu-btn" onClick={() => setMenuState('url-input')}>
                Enter URL
              </button>
              <button type="button" className="recipe-image-menu-btn" onClick={closeMenu}>
                Cancel
              </button>
            </>
          )}
          {(menuState === 'url-input' || menuState === 'loading') && (
            <form className="recipe-image-url-form" onSubmit={handleUrlSubmit}>
              <input
                className="recipe-image-url-input"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                autoFocus
                disabled={menuState === 'loading'}
              />
              <button type="submit" className="recipe-image-menu-btn" disabled={menuState === 'loading'}>
                {menuState === 'loading' ? 'Loading…' : 'Load image'}
              </button>
              <button type="button" className="recipe-image-menu-btn" onClick={() => setMenuState('options')}>
                Back
              </button>
              {errorMsg && <p className="recipe-image-error">{errorMsg}</p>}
            </form>
          )}
          {menuState === 'options' && errorMsg && (
            <p className="recipe-image-error">{errorMsg}</p>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        onClick={e => { (e.target as HTMLInputElement).value = ''; }}
      />
    </div>
  );
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd apps/web && pnpm vitest run src/pages/RecipesPage/RecipeImagePicker.test.tsx
```

Expected: all 7 tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx apps/web/src/pages/RecipesPage/RecipeImagePicker.test.tsx
git commit -m "feat: add RecipeImagePicker component with clipboard/file/URL support"
```

---

## Task 4: Update RecipeForm.tsx

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipeForm.tsx`

- [ ] **Step 1: Add CSS import and RecipeImagePicker import**

At the top of `apps/web/src/pages/RecipesPage/RecipeForm.tsx`, add after the existing imports:

```tsx
import './RecipeForm.css';
import { RecipeImagePicker } from './RecipeImagePicker';
```

The existing imports to keep:
```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { useRecipe, useAddRecipe, useUpdateRecipe } from '../../hooks/useRecipes';
import type { CanonicalFood, RecipeIngredientInput, ImportedRecipe } from '@eat/shared';
import '../InventoryPage/ItemForm.css';
import './RecipesPage.css';
import './RecipeForm.css';
import { RecipeImagePicker } from './RecipeImagePicker';
```

- [ ] **Step 2: Update IngredientRow to use new class names**

Replace the entire `IngredientRow` function (lines 19–44):

```tsx
function IngredientRow({ draft, onChange, onRemove }: IngredientRowProps) {
  return (
    <li className={`ingredient-row${draft.lowConfidence ? ' ingredient-row--unmatched' : ''}`}>
      <span
        className="ingredient-name"
        title={draft.lowConfidence ? `Unmatched: "${draft.foodName ?? 'unknown'}" — please reassign` : undefined}
      >
        {draft.foodName ?? '⚠ unmatched'}{draft.optional ? ' (optional)' : ''}
      </span>
      <div className="ingredient-controls">
        <input
          className="form-input ingredient-qty"
          type="text"
          value={draft.qty || ''}
          onChange={e => onChange({ ...draft, qty: e.target.value })}
          aria-label="Quantity"
        />
        <input
          type="text"
          className="form-select ingredient-unit"
          value={draft.unit}
          onChange={e => onChange({ ...draft, unit: e.target.value })}
          aria-label="Unit"
        />
        <button type="button" className="ingredient-remove" onClick={onRemove} aria-label="Remove ingredient">✕</button>
      </div>
    </li>
  );
}
```

- [ ] **Step 3: Add photo state inside RecipeForm**

Inside the `RecipeForm` function, after the existing `useState` declarations (after line 123 `const [hydrated, setHydrated] = ...`), add:

```tsx
const [photoBase64, setPhotoBase64] = useState<string | null>(pendingPhoto?.base64 ?? null);
const [photoMimeType, setPhotoMimeType] = useState<string | null>(pendingPhoto?.mimeType ?? null);
```

- [ ] **Step 4: Update the payload in handleSubmit**

Find this block in `handleSubmit` (near line 186):

```tsx
...(pendingPhoto && { photoBase64: pendingPhoto.base64, photoMimeType: pendingPhoto.mimeType }),
```

Replace with:

```tsx
...(photoBase64 && photoMimeType && { photoBase64, photoMimeType }),
```

- [ ] **Step 5: Replace the form JSX**

Replace the entire `<form className="recipe-form" ...>` block. The new JSX (the full form contents to paste in, replacing everything from `<form` to `</form>`):

```tsx
<form className="recipe-form" onSubmit={handleSubmit} noValidate>
  <div className="recipe-form-header">
    <div className="recipe-form-meta">
      <div className="form-field">
        <label className="form-label" htmlFor="name">Name *</label>
        <input
          id="name"
          className="form-input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Spaghetti bolognese"
          required
        />
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label" htmlFor="servings">Servings *</label>
          <input
            id="servings"
            className="form-input"
            type="number"
            step="any"
            min="0"
            value={servings}
            onChange={e => setServings(e.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label className="form-label" htmlFor="sourceUrl">Source URL</label>
          <input
            id="sourceUrl"
            className="form-input"
            type="url"
            placeholder="Optional"
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
          />
        </div>
      </div>
    </div>
    <RecipeImagePicker
      photoBase64={photoBase64}
      photoMimeType={photoMimeType}
      onChange={(base64, mimeType) => { setPhotoBase64(base64); setPhotoMimeType(mimeType); }}
    />
  </div>

  <hr className="recipe-form-divider" />

  <div className="ingredients-section">
    <div className="ingredients-section-header">
      <span className="ingredients-section-title">Ingredients</span>
      {ingredients.length > 0 && (
        <span className="ingredients-section-count">
          {ingredients.length} {ingredients.length === 1 ? 'item' : 'items'}
        </span>
      )}
    </div>
    {ingredients.length > 0 && (
      <div className="ingredients-block">
        <ul className="ingredients-grid">
          {ingredients.map((ing, idx) => (
            <IngredientRow
              key={ing.canonicalFoodId}
              draft={ing}
              onChange={next => updateIngredient(idx, next)}
              onRemove={() => removeIngredient(idx)}
            />
          ))}
        </ul>
      </div>
    )}
    <IngredientPicker onPick={addIngredient} />
  </div>

  <div className="form-field">
    <label className="form-label" htmlFor="instructions">Instructions</label>
    <textarea
      id="instructions"
      className="form-textarea"
      value={instructions}
      onChange={e => setInstructions(e.target.value)}
      placeholder="Optional. Step-by-step or free-form."
    />
  </div>

  {error && <p className="form-error" role="alert">{error}</p>}

  <div className="form-actions">
    <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
    <button type="submit" className="btn-primary" disabled={isPending}>
      {isPending ? 'Saving…' : initialData ? 'Save imported recipe' : mode === 'add' ? 'Add recipe' : 'Save changes'}
    </button>
  </div>
</form>
```

- [ ] **Step 6: Run the full test suite**

```bash
cd /path/to/repo && pnpm test
```

Expected: all existing tests pass. No new failures. The component tests added in Task 3 also pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipeForm.tsx
git commit -m "feat: redesign recipe modal — two-zone layout, image picker, ingredient grid"
```

---

## Task 5: Smoke test in the browser

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Verify the following**

Open the Recipes page and open the Add recipe modal. Check:

1. Modal is visibly wider (~680px) on desktop
2. Name field + servings/URL row sit in the left column; image placeholder box on the right
3. Clicking the image placeholder opens the option menu (Paste / Choose file / Enter URL / Cancel)
4. Choosing a file populates the image
5. Clicking the filled image shows "Remove photo" option
6. Adding 4 ingredients shows them in a 2-column grid on desktop; resize to mobile (< 600px) and verify they restack to 1 column
7. Ingredient name dominates; qty/unit inputs are narrow; ✕ button is subtle
8. Instructions textarea uses a serif font and is taller than a normal input
9. The hairline divider visually separates metadata from ingredients
10. Submit still works (add a recipe end-to-end)

- [ ] **Step 3: Commit any fixes found during smoke test**

---

## Self-Review

### Spec coverage
- [x] `.recipe-form` padding — Task 2 (`.recipe-form` rule with `padding: 20px 24px 24px`)
- [x] Modal 680px — Task 1
- [x] Two visual zones (metadata strip + ingredients centrepiece) — Task 2 CSS + Task 4 JSX
- [x] Ingredient rows: name left large, qty/unit compact right, remove subtle — Task 2 + Task 4 Step 2
- [x] Instructions textarea: full-width, taller, serif — Task 2 (`.form-textarea`)
- [x] Design tokens — Task 2 uses `--paper`, `--ink`, `--rule`, `--persimmon`, `--font-serif`, `--font-sans`, etc. throughout
- [x] Image placeholder with URL/file/clipboard — Task 3
- [x] `pendingPhoto` prop pre-fills state — Task 4 Step 3
- [x] 2-column ingredient grid desktop / 1-column mobile — Task 2 + Task 4 Step 5

### No placeholders found — all steps have exact code.

### Type consistency
- `RecipeImagePicker` props: `photoBase64: string | null`, `photoMimeType: string | null`, `onChange: (base64: string | null, mimeType: string | null) => void` — consistent across Task 3 (definition) and Task 4 Steps 1, 3, 5 (usage)
- `blobToBase64` exported in Task 3, imported in tests — consistent
- Photo state: `photoBase64`/`photoMimeType` initialized in Step 3, used in payload Step 4, passed to component Step 5 — consistent
