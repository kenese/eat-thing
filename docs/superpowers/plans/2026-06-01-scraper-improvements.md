# Scraper Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree:** Create an isolated worktree before starting — use the `superpowers:using-git-worktrees` skill.
>
> **Recommended model:** claude-sonnet-4-6

**Goal:** Two fixes to the recipe URL extractor: (1) add browser-like request headers to reduce bot-detection blocks (taste.com.au, seriouseats.com), (2) fix langbein.com-style sites where Schema.org data exists but has no instructions — currently Gemini is never called in this case, so instructions are silently lost. Also fix a pre-existing bug where `response.text()` is consumed before the `response.ok` check tries to read the body again.

**Architecture:** All changes are in `apps/server/src/lib/recipe-extractor.ts`. The key logic change: if `parseSchemaOrg` returns a recipe with no instructions, still call `extractWithGemini` to supplement the instructions. The headers change is a one-liner on the `fetch` call.

**Tech Stack:** Node.js fetch, existing Gemini/Readability pipeline. No new dependencies.

---

## File map

| File | Change |
|---|---|
| `apps/server/src/lib/recipe-extractor.ts` | Browser-like headers, fix response.ok bug, Schema.org + Gemini fallback for missing instructions |
| `apps/server/src/lib/recipe-extractor.test.ts` | Tests for the Gemini fallback and header presence |

---

## Task 1: Fix response.ok bug and add browser-like headers

**Files:**
- Modify: `apps/server/src/lib/recipe-extractor.ts`

- [ ] **Step 1: Write tests for the headers and error handling**

In `apps/server/src/lib/recipe-extractor.test.ts`, add after existing tests:

```ts
import { extractFromUrl } from './recipe-extractor.js';
// Note: extractFromUrl is NOT in the existing named exports list.
// Check if it's already exported:
```
```bash
grep "export.*extractFromUrl" apps/server/src/lib/recipe-extractor.ts
```
If not exported for testing, add it to the export list at the bottom of `recipe-extractor.ts` alongside the existing exports:
```ts
export {parseSchemaOrg, annotateMetric, resolveHeroImage, extractFromUrl};
```

Then add tests. The existing test file already mocks `food-matcher.js` and `gemini.js` — add these tests following the same mock setup at the top:

```ts
// The fetchMock must be set up before importing extractFromUrl in tests.
// Add these tests in the describe block or at the top level:

describe('extractFromUrl headers', () => {
  it('sends a Chrome-like User-Agent header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe', name: 'Test', recipeYield: '4',
        recipeIngredient: ['1 cup water'],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil.' }],
      })}</script>`,
      headers: new Headers({ 'content-type': 'text/html' }),
    } as Response);

    await extractFromUrl('https://example.com/recipe');

    const [, init] = fetchSpy.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/Chrome/);
    expect(headers['Accept']).toBeDefined();
    fetchSpy.mockRestore();
  });

  it('throws a clean error on non-ok response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    } as Response);

    await expect(extractFromUrl('https://example.com/blocked')).rejects.toThrow('HTTP 403');
    fetchSpy.mockRestore();
  });
});
```

Run: `pnpm --filter @eat/server test -- --reporter=verbose recipe-extractor`
Expected: FAIL — headers test fails (current User-Agent is 'eat-thing-bot'), error test may also fail.

- [ ] **Step 2: Fix the extractFromUrl function — headers and response.ok bug**

Find the `extractFromUrl` function. It currently starts with:
```ts
export async function extractFromUrl(url: string): Promise<ExtractedRecipe> {
    const response = await fetch(url, {
        headers: {'User-Agent': 'Mozilla/5.0 (compatible; eat-thing-bot/1.0)'},
        signal: AbortSignal.timeout(20_000),
    });
    const html = await response.text();
    if (!response.ok) {
        const body = await response.json().catch((e) => {
            console.log(`Fetch failed: ${response.status}`, body, err);
        });
        const err = Object.assign(new Error(body?.error ?? `HTTP ${response.status}`), {
            status: response.status,
        });
        console.log(`Fetch failed: ${response.status}`, body, err);
        throw new Error(`Fetch failed: ${response.status}`);
    }
```

Replace the `fetch` call and the entire `if (!response.ok)` block with:
```ts
export async function extractFromUrl(url: string): Promise<ExtractedRecipe> {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @eat/server test -- --reporter=verbose recipe-extractor
```
Expected: header and error tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/recipe-extractor.ts apps/server/src/lib/recipe-extractor.test.ts
git commit -m "fix: browser-like headers on recipe fetch; clean up response.ok error handling"
```

---

## Task 2: Gemini fallback when Schema.org has no instructions

**Files:**
- Modify: `apps/server/src/lib/recipe-extractor.ts`

This fixes langbein.com and any other site where Schema.org data is present but `recipeInstructions` is absent. Currently, once `parseSchemaOrg` returns a non-null result, `extractWithGemini` is never called — even if the instructions are missing.

- [ ] **Step 1: Write the failing test**

Add to `apps/server/src/lib/recipe-extractor.test.ts`:

```ts
describe('Gemini fallback for missing instructions', () => {
  it('calls Gemini when Schema.org recipe has no instructions', async () => {
    const { generateGeminiJson } = await import('./gemini.js');
    const geminiMock = generateGeminiJson as ReturnType<typeof vi.fn>;
    geminiMock.mockResolvedValueOnce({
      name: 'Warm Greek Lamb Salad',
      servings: 4,
      sections: [{
        name: null,
        ingredients: [],
        instructions: 'Toss the lamb with the greens and serve warm.',
      }],
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'Warm Greek Lamb Salad',
        recipeYield: '4',
        recipeIngredient: ['500g lamb'],
        // Note: NO recipeInstructions field
      })}</script>`,
      headers: new Headers({ 'content-type': 'text/html' }),
    } as Response);

    const result = await extractFromUrl('https://www.langbein.com/recipes/warm-greek-lamb-salad');
    expect(result.instructions).toBe('Toss the lamb with the greens and serve warm.');
    expect(geminiMock).toHaveBeenCalled();

    fetchSpy.mockRestore();
    geminiMock.mockReset();
  });

  it('does NOT call Gemini when Schema.org already has instructions', async () => {
    const { generateGeminiJson } = await import('./gemini.js');
    const geminiMock = generateGeminiJson as ReturnType<typeof vi.fn>;

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'Simple Soup',
        recipeYield: '4',
        recipeIngredient: ['1 cup water'],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil water.' }],
      })}</script>`,
      headers: new Headers({ 'content-type': 'text/html' }),
    } as Response);

    await extractFromUrl('https://example.com/soup');
    expect(geminiMock).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
```

Run: `pnpm --filter @eat/server test -- --reporter=verbose recipe-extractor`
Expected: FAIL — first test fails because Gemini is not called when Schema.org returns a result.

- [ ] **Step 2: Change the extraction logic to supplement with Gemini when instructions are missing**

In `extractFromUrl`, find the extraction block:
```ts
    try {
        const schemaRaw = parseSchemaOrg(html);
        const raw = schemaRaw ?? await extractWithGemini(cleanHtmlWithReadability(html));
        if (!raw) {
```
Replace with:
```ts
    try {
        const schemaRaw = parseSchemaOrg(html);
        let raw = schemaRaw;

        // If Schema.org parsed but has no instructions, supplement with Gemini
        if (!raw?.instructions) {
            const cleanText = cleanHtmlWithReadability(html);
            const gemini = await extractWithGemini(cleanText);
            if (schemaRaw) {
                // Preserve Schema.org name/servings/ingredients; use Gemini instructions
                raw = { ...schemaRaw, instructions: gemini?.instructions ?? null };
            } else {
                raw = gemini;
            }
        }

        if (!raw) {
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @eat/server test -- --reporter=verbose recipe-extractor
```
Expected: all tests pass including the new Gemini fallback tests.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/recipe-extractor.ts apps/server/src/lib/recipe-extractor.test.ts
git commit -m "fix: call Gemini when Schema.org recipe is missing instructions (fixes langbein.com)"
```

---

## Self-review checklist

After all tasks:
- [ ] Run `pnpm --filter @eat/server test` — all tests pass.
- [ ] Spec coverage: browser-like headers ✓; HTTP error handling fixed ✓; Gemini fallback when no instructions ✓; Gemini still skipped when instructions present ✓.
- [ ] **Manual smoke test (optional but recommended):** With the dev server running, import a recipe from `https://www.langbein.com/recipes/warm-greek-lamb-salad` and confirm instructions are present. Then try `https://www.taste.com.au/...` — if still blocked (403/Cloudflare), that's acceptable for this iteration (the "better headers" approach was the agreed first step; Playwright escalation can follow separately).
