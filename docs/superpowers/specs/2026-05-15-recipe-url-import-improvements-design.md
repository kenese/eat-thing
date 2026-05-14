# Recipe URL Import Improvements — Design

**Date:** 2026-05-15  
**Status:** Approved  
**Scope:** Pre-Phase 4 improvements to URL recipe ingestion

---

## Overview

Five targeted improvements to `apps/server/src/lib/recipe-extractor.ts` and related types/schema. All changes flow through a single sequential pipeline (Approach A). One DB migration adds two columns to `recipe_ingredients`.

---

## Data Model

### Migration — `recipe_ingredients`

Add two nullable columns:

| Column | Type | Purpose |
|---|---|---|
| `section` | `text` | Component name the ingredient belongs to (e.g. `"For the sauce"`). Null for unsectioned recipes. |
| `metric_value` | `text` | Pre-formatted metric string (e.g. `"5 ml"`, `"28 g"`). Null when conversion is not possible. |

No change to `recipes.instructions` — instruction sections are encoded as markdown headers (`## Section Name\n\nStep 1...`) in the existing text column. This renders correctly in the existing UI without any migration.

### Shared types (`packages/shared/src/index.ts`)

`RecipeIngredient` gains:
```ts
section: string | null;
metricValue: string | null;
```

`ImportedIngredient` gains:
```ts
section: string | null;
metric: string | null;
```

---

## Extraction Pipeline

Sequential flow in `recipe-extractor.ts`:

```
fetch(url)
  → raw HTML
  → parseSchemaOrg(html)
      found  → build RawExtracted (with section + image support, see below)
      not found → cleanWithReadability(html) → extractWithGemini(cleanText)
  → annotateMetric(raw.ingredients)
  → resolveHeroImage(html, url)
  → matchIngredients(...)
  → return ExtractedRecipe
```

### 1. Readability replaces `stripHtml`

`getCleanRecipeHTML` is refactored to accept `html: string` instead of fetching by URL. It runs jsdom + Readability and returns the article text content.

This function is **only called on the Gemini fallback path** — schema.org parsing still runs on the raw HTML because `<script type="application/ld+json">` tags are stripped by Readability.

### Internal type change — `SchemaRecipeIngredient`

The internal `SchemaRecipeIngredient` interface gains `section?: string` so both schema.org and Gemini paths can attach section names to individual ingredients before the shared annotation step. `RawExtracted.ingredients` stays as `SchemaRecipeIngredient[]`; instructions sections are assembled into the markdown-header format before being stored in `RawExtracted.instructions`.

### 2. No paraphrasing — Gemini prompt changes

Remove the existing metric-conversion instruction:
> ~~Convert measurements to grams or ml where possible...~~

Replace with:
> Preserve all original quantities and units exactly as written. Do not paraphrase ingredients or instructions — keep the original wording.

The Gemini response schema changes from a flat structure to sections:

```json
{
  "name": "string",
  "servings": 4,
  "sections": [
    {
      "name": "string or null",
      "ingredients": [{"name": "string", "qty": "string", "unit": "string"}],
      "instructions": "string or null"
    }
  ]
}
```

A recipe with no sections will return a single section with `name: null`. The extractor merges single-null-section results into the existing flat `ingredients` + `instructions` shape for backward compatibility.

### 3. Schema.org section support

`extractSchemaNode` is updated to handle `HowToSection` objects in `recipeInstructions`. Each section becomes:

```
## Section Name

Step 1 text

Step 2 text
```

appended to the instructions string. `HowToStep` objects without a parent section are formatted as before. Sectioned ingredients are not a schema.org standard — the `section` field on ingredients only populates via the Gemini path.

### 4. Metric annotation (`annotateMetric`)

After extraction (schema.org or Gemini path), each ingredient is passed through the existing `normalizeRecipeAmount()` from `recipe-quantities.ts`. If it returns a value, format as `"240 ml"` or `"28 g"` and attach as the `metric` field. If conversion fails (e.g. "pinch", "sprig"), `metric` is null.

This is **display-only** — shopping-list aggregation and cook-event deduction continue to use runtime `toCanonical()` conversion.

> **Idea for later (IDEAS.md):** Make metric values the source of truth for shopping-list aggregation and cook-event deduction, replacing the current runtime conversion. Would require updating `shopping-list-generator.ts` and the cook-event route.

### 5. Hero image (`resolveHeroImage`)

Resolution order:
1. `<meta property="og:image" content="...">` 
2. `<meta name="twitter:image" content="...">` 
3. First `<img src="...">` where src ends in `.jpg`, `.jpeg`, `.png`, or `.webp` and is not a data URI
4. Null (silent — no error thrown)

`resolveHeroImage(html, baseUrl)` returns the resolved absolute image URL (not yet uploaded). `ExtractedRecipe` gains `heroImageUrl: string | null`.

**Upload happens on save**, not during extraction — consistent with the photo import pattern. When `POST /api/recipes` receives a `heroImageUrl`, the recipes route fetches the image bytes and uploads to Supabase Storage, storing the resulting path in `source_image`. The `ImportedRecipe` shared type gains `heroImageUrl: string | null` so the frontend can display a preview in the edit-and-confirm step.

All image resolution errors are caught and logged; a failure does not abort recipe extraction.

---

## Testing

### Unit tests (Vitest)

New or updated in `recipe-extractor.test.ts`:

- `parseSchemaOrg` with a `HowToSection` fixture — sections appear as `## Header` markdown blocks in instructions
- `parseSchemaOrg` with a flat `HowToStep` array — existing behaviour unchanged
- `annotateMetric`: known conversions (1 tsp → "5 ml", 1 cup → "240 ml", 1 oz → "28 g") and unknowns (pinch, sprig → null)
- `resolveHeroImage`: OG-tag HTML → returns URL; image-tag fallback HTML → returns URL; no-image HTML → returns null

### Integration tests

`ingest.test.ts` fixture responses updated to include `section`, `metricValue`, and `sourceImage` fields — verifies the shape contract at the route boundary.

### E2E

No new E2E tests — the edit-and-confirm UI flow is unchanged. Sections and metric are additive fields that pre-fill into the existing `RecipeForm`.

---

## Scope boundary

- No changes to `RecipeForm` UI for manually adding/editing sections (deferred)
- No changes to shopping-list or cook-event logic (metric is display-only)
- No changes to photo ingestion path (`photo-extractor.ts`)
- No changes to OpenBrain or MealDB import paths
