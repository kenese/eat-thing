# Recipe Modal Visual Redesign

**Date:** 2026-05-15

## Problem

RecipeForm renders inside the shared modal shell but has almost no recipe-specific CSS — `.recipe-form`, `.form-textarea`, `.ingredient-row`, `.ingredient-name`, `.ingredients-section`, `.ingredients-list` are all undefined. The result is an unstyled flat stack of browser-default form elements.

Additional issues:
- Modal max-width 480px — too cramped for ingredients + instructions side by side
- No image support in the form UI (the API already accepts `photoBase64`/`photoMimeType`)

## Design

### Modal width
Change `max-width` on `.modal-panel` in `ItemForm.css` from `480px` → `680px` (desktop breakpoint ≥ 600px).

### New CSS file: `RecipeForm.css`
All recipe-form-specific styles go in a new `RecipeForm.css` co-located in `RecipesPage/`. RecipeForm.tsx adds `import './RecipeForm.css'`. This keeps the shared modal base (ItemForm.css) unchanged beyond the width fix.

All new rules use the real design tokens (`--paper`, `--ink`, `--rule`, `--persimmon`, `--font-serif`, `--font-sans`, `--radius-card`, `--radius-control`, etc.) — not the legacy `--bg-secondary`/`--border` tokens that ItemForm.css still references.

### Zone 1 — Metadata + Image strip

Desktop: two-column grid — `[meta] [image]`. Meta takes ~`1fr`, image is a fixed `180px` square.
Mobile (≤600px): stacked, image above meta (or below — image goes second so name is immediately visible).

**Meta sub-layout:** name full-width, then servings + source URL in a `1fr 2fr` row below.

**Image box:**
- `180×180px`, `border-radius: var(--radius-card)`, `background: var(--paper2)`, `border: 1.5px dashed` using `--rule` colour
- When empty: centred persimmon `+` icon (24px) + small "Add photo" label in `--mute`
- Clicking opens a small inline menu (3 options stacked):
  - "Paste from clipboard" — reads `navigator.clipboard.read()` for image items
  - "Choose file" — triggers a hidden `<input type="file" accept="image/*">`
  - "Enter URL" — reveals a small text input inline; on confirm, fetches the image client-side (`fetch → blob → FileReader.readAsDataURL`), strips the data-URI prefix, stores as `photoBase64` + `photoMimeType`
- When filled: image fills the box (`object-fit: cover`); clicking it shows a "Replace / Remove" menu
- `pendingPhoto` prop pre-fills the box (import flow) — treated the same as a manually added photo

**State additions in RecipeForm.tsx:**
- `photoBase64: string | null` + `photoMimeType: string | null` (replaces reading from `pendingPhoto` directly in the payload)
- Initialised from `pendingPhoto` on mount
- `imageMenuOpen: boolean`

The existing payload already sends `photoBase64`/`photoMimeType` — just wire the new state into it.

### Zone 2 — Ingredients (centrepiece)

Section heading: serif italic `"Ingredients"` (matches `rx-section-title` style), with a muted item count on the right.

**Ingredient grid:**
- Desktop: `display: grid; grid-template-columns: 1fr 1fr; gap: 0` — two ingredients per row
- Mobile (≤600px): `grid-template-columns: 1fr`

Each ingredient cell (`.ingredient-row`):
- `display: flex; align-items: center; gap: 8px`
- `.ingredient-name`: `flex: 1; font-size: 15px` — name dominates
- `.ingredient-controls`: `display: flex; gap: 4px; align-items: center`
  - qty input: `width: 56px`
  - unit input: `width: 72px`
  - remove button: `color: var(--ink3)`, no background, no border, `font-size: 12px`
- Row bottom border: `1px solid var(--rule2)` (light internal divider)
- Unmatched state (`.ingredient-row--unmatched`): name in `var(--persimmon)`

Ingredients block gets a `background: var(--paper2); border-radius: var(--radius-card); padding: 4px 0` wrapper so it reads as a contained zone.

A `1px solid var(--rule)` hairline separates the metadata strip from the ingredients zone.

### Zone 3 — Instructions

`.form-textarea`:
- `width: 100%`; `min-height: 140px`
- `font-family: var(--font-serif)`, `font-size: 15px`, `line-height: 1.6`
- Matches form-input border/background style (`var(--paper)` bg, `1px solid var(--rule)` border, `var(--radius-control)`)
- Resize: vertical only

## Files changed

| File | Change |
|---|---|
| `apps/web/src/pages/InventoryPage/ItemForm.css` | `max-width: 480px` → `680px` |
| `apps/web/src/pages/RecipesPage/RecipeForm.css` | **new** — all recipe-form styles |
| `apps/web/src/pages/RecipesPage/RecipeForm.tsx` | add CSS import; add photo state + image box UI; change ingredient list to grid |

## Out of scope
- Fixing the legacy `--bg-secondary`/`--border` token usage in ItemForm.css (separate task)
- CORS failures on "Enter URL" — if the image URL blocks cross-origin fetch, surface an error and let the user try file picker instead
- Tests: this is purely visual/CSS — no business logic changes, so no Vitest/Playwright updates needed. The ingredient grid is layout only; existing mutation logic is untouched.
