# eat-thing improvements — design spec
_2026-06-01_

## Decisions from brainstorming

- **Library bucket**: Remove entirely. Recipes with 4+ missing ingredients appear in "All" with no special grouping.
- **Capitalisation**: Editorial all-lowercase for all button/inline text. Sentence case only for modal `h2` headers and page titles.
- **Blocked crawlers**: Better browser-like headers first (realistic Chrome User-Agent, Accept, Accept-Language, Referer).

---

## Group 1 — CSS/text fixes (Haiku)

### 1a. Instructions italic bug
**Root cause**: `index.html` loads `Lora:ital,wght@1,400;1,500` (italic-only). Any element using `--font-serif` without `font-style: normal` renders italic.  
**Fix**: Change font import to `Lora:ital,wght@0,400;0,500;1,400;1,500`. Add `font-style: normal` to `.recipe-view-instructions` and `.form-textarea`.

### 1b. Capitalisation
All button text and inline action labels → lowercase. Only `h2` modal headers and page titles stay sentence case.  
Files: `RecipesPage.tsx`, `RecipeForm.tsx`, `ImportModal.tsx`, `PlanPage.tsx`, `ShoppingListPage.tsx`, etc.

### 1c. Modal layout
Remove `min-width: 960px` from `.modal-panel--recipe`. Replace with `max-width: 760px` and proper fluid padding for small viewports.  
File: `RecipeForm.css`.

---

## Group 2 — UI logic (Haiku)

### 2a. Delete from modal
Add a "delete" button to the read-only recipe view. Two-step confirmation inline (click → "confirm delete?" → confirm → delete + close). Style with `--warn` (#c2412e).  
Files: `RecipeForm.tsx`, `RecipeForm.css`. Uses existing `useDeleteRecipe` hook.

### 2b. Remove Library bucket
- Remove `'library'` from the `Tab` type.
- Remove the "Library" tab from the `tabs` array.
- Remove the "The library" section from the cookable-first All view.
- `bucketRecipe` can remain as-is internally; nothing in the UI surfaces the library bucket.  
File: `RecipesPage.tsx`.

### 2c. Sections rendering
**Ingredients**: In read-only view, group ingredients by `section` field. Null/empty = unsectioned at top. Each section gets a styled header.  
**Instructions**: Parse `## Heading` lines into `<h3>` elements. Simple split on `\n` — no markdown library.  
File: `RecipeForm.tsx`, `RecipeForm.css`.

---

## Group 3 — Drag-drop between days (Sonnet)

Add a second drag type `application/x-eat-plan-entry-id` for moving existing meal plan entries between days.  
- Day card entries get `draggable` attribute + `onDragStart` setting entry ID + source date.
- Day card `onDrop` handler: detects drag type. If `x-eat-plan-entry-id`, calls `updateEntry({ date: targetDate })` to move.
- If dropping onto a day that already has the max entries: no-op (show visual indicator).  
Files: `PlanPage.tsx`, `PlanPage.css`.

---

## Group 4 — Image URL extraction from page (Sonnet)

**New server endpoint**: `GET /api/ingest/hero-image?url=...`  
- Fetches the page HTML.
- Runs existing `resolveHeroImage()` to find og:image / twitter:image.
- Downloads the image, uploads to Supabase storage, returns `{ imageUrl }`.

**Frontend**: `RecipeImagePicker.tsx` "Enter URL" path calls `POST /api/ingest/hero-image` instead of fetching the URL directly. Handles both direct image URLs and recipe page URLs gracefully.  
Files: `apps/server/src/routes/ingest.ts`, `RecipeImagePicker.tsx`.

---

## Group 5 — Scraper fixes (Sonnet)

### 5a. langbein.com instructions missing
Investigate: likely Schema.org data present but `recipeInstructions` absent, and Readability strips content Gemini needs. Fix: trace the extraction path for that URL, patch accordingly.  
File: `apps/server/src/lib/recipe-extractor.ts`.

### 5b. Blocked crawlers
Replace the bot User-Agent with a realistic Chrome string. Add `Accept`, `Accept-Language`, `Cache-Control` headers to the `extractFromUrl` fetch call.  
File: `apps/server/src/lib/recipe-extractor.ts`.

---

## Implementation approach
Each group runs in its own git worktree on a feature branch. Groups 1 and 2 can run in parallel. Group 3 can run in parallel with Groups 1/2. Groups 4 and 5 are backend-heavy and can run in parallel with each other. All merge to main when done.
