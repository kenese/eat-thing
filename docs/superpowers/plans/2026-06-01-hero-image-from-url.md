# Hero Image from URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Worktree:** Create an isolated worktree before starting — use the `superpowers:using-git-worktrees` skill.
>
> **Recommended model:** claude-sonnet-4-6

**Goal:** The "Enter URL" option in the recipe image picker currently only accepts direct image URLs (e.g. `https://example.com/photo.jpg`). Change it so you can paste either a direct image URL or a recipe page URL — the server extracts the `og:image` from the page, downloads the image, and returns it as base64. This uses the existing `resolveHeroImage` logic from the extractor.

**Architecture:** New server endpoint `POST /api/ingest/hero-image` accepts a URL, sniffs whether the response is HTML or an image, extracts/downloads accordingly, and returns `{ base64, mimeType }`. The frontend replaces its direct `fetch(url)` call with a call to this endpoint. The existing `onChange(base64, mimeType)` interface on `RecipeImagePicker` is unchanged.

**Tech Stack:** Express (server), React (frontend). Uses existing `resolveHeroImage` export from `recipe-extractor.ts`. No new dependencies.

---

## File map

| File | Change |
|---|---|
| `apps/server/src/routes/ingest.ts` | New `POST /hero-image` route |
| `apps/server/src/lib/recipe-extractor.ts` | Verify `resolveHeroImage` is exported (it already is) |
| `apps/server/src/routes/ingest.test.ts` | Test the new endpoint |
| `apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx` | Replace direct image fetch with server call |

---

## Task 1: Server endpoint — extract hero image from URL

**Files:**
- Modify: `apps/server/src/routes/ingest.ts`

- [ ] **Step 1: Verify resolveHeroImage is exported**

```bash
grep "export.*resolveHeroImage" apps/server/src/lib/recipe-extractor.ts
```
Expected output:
```
export {parseSchemaOrg, annotateMetric, resolveHeroImage};
```
If not present, add `resolveHeroImage` to that export line. No change expected.

- [ ] **Step 2: Write the failing test**

In `apps/server/src/routes/ingest.test.ts`, look at the existing test structure first:
```bash
head -30 apps/server/src/routes/ingest.test.ts
```
Add a new describe block at the bottom of that file:

```ts
describe('POST /api/ingest/hero-image', () => {
  it('returns 400 for missing url', async () => {
    // This test uses the existing supertest setup in the file.
    // Check what setup is already there and follow the same pattern.
    // If the file uses `app` from `../../app.js` and supertest, add:
    const res = await request(app)
      .post('/api/ingest/hero-image')
      .set('Cookie', authCookie)   // use whatever auth setup the file already uses
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
```

Run: `pnpm --filter @eat/server test -- --reporter=verbose ingest`
Expected: FAIL with "Cannot POST /api/ingest/hero-image" (endpoint doesn't exist yet).

> **Note for implementer:** look at the existing tests in `ingest.test.ts` to understand how `app`, auth cookies, and mocking are set up. Use the same patterns — don't invent new ones.

- [ ] **Step 3: Add the hero-image endpoint to ingest.ts**

In `apps/server/src/routes/ingest.ts`, add this import at the top alongside the existing imports:
```ts
import {resolveHeroImage} from '../lib/recipe-extractor.js';
```

Then add the new route after the existing routes (before `export default router`):
```ts
// POST /api/ingest/hero-image
router.post('/hero-image', withHousehold, async (req, res) => {
    const parse = z.object({url: z.string().url()}).safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({error: 'Valid URL required'});
        return;
    }

    const {url} = parse.data;

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        const response = await fetch(url, {headers, signal: AbortSignal.timeout(15_000)});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentType = response.headers.get('content-type') ?? '';

        if (contentType.startsWith('image/')) {
            // Direct image URL — just proxy it back as base64
            const mimeType = contentType.split(';')[0].trim();
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            res.json({base64, mimeType});
            return;
        }

        // HTML page — extract hero image URL from og:image / twitter:image
        const html = await response.text();
        const heroImageUrl = resolveHeroImage(html, url);
        if (!heroImageUrl) {
            res.status(422).json({error: 'No image found on this page.'});
            return;
        }

        const imgRes = await fetch(heroImageUrl, {
            headers,
            signal: AbortSignal.timeout(10_000),
        });
        if (!imgRes.ok) throw new Error(`Image fetch failed: HTTP ${imgRes.status}`);

        const imgContentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
        const mimeType = imgContentType.split(';')[0].trim();
        const buffer = await imgRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        res.json({base64, mimeType});
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to extract image';
        console.error('[ingest/hero-image]', err);
        res.status(422).json({error: msg});
    }
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @eat/server test -- --reporter=verbose ingest
```
Expected: new test passes; all existing ingest tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/ingest.ts apps/server/src/routes/ingest.test.ts
git commit -m "feat: POST /api/ingest/hero-image — extract og:image from page URL or proxy direct image"
```

---

## Task 2: Frontend — update RecipeImagePicker to use the endpoint

**Files:**
- Modify: `apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx`

- [ ] **Step 1: Write the failing test**

In `apps/web/src/pages/RecipesPage/RecipeImagePicker.test.tsx`, look at existing tests first:
```bash
head -40 apps/web/src/pages/RecipesPage/RecipeImagePicker.test.tsx
```
Add a test for the URL flow:

```tsx
// Add to RecipeImagePicker.test.tsx

describe('Enter URL — server-side image extraction', () => {
  it('calls /api/ingest/hero-image and returns base64 to onChange', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ base64: 'abc123', mimeType: 'image/jpeg' }),
    } as Response);

    const onChange = vi.fn();
    render(<RecipeImagePicker photoBase64={null} photoMimeType={null} onChange={onChange} />);

    // Open menu
    fireEvent.click(screen.getByText(/add photo/i));
    // Click "enter URL"
    fireEvent.click(screen.getByText(/enter url/i));
    // Type a URL
    const input = screen.getByPlaceholderText(/recipe page/i);
    fireEvent.change(input, { target: { value: 'https://example.com/recipe' } });
    // Submit
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/ingest/hero-image',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(onChange).toHaveBeenCalledWith('abc123', 'image/jpeg');
    });

    fetchSpy.mockRestore();
  });
});
```

Run: `pnpm --filter @eat/web test -- --reporter=verbose RecipeImagePicker`
Expected: FAIL — the component still calls `fetch(url)` directly, not `/api/ingest/hero-image`.

- [ ] **Step 2: Replace handleUrlSubmit in RecipeImagePicker.tsx**

Find the existing `handleUrlSubmit` function:
```tsx
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
```
Replace with:
```tsx
async function handleUrlSubmit(e: React.FormEvent) {
  e.preventDefault();
  const url = urlInput.trim();
  if (!url) return;
  setMenuState('loading');
  setErrorMsg('');
  try {
    const res = await fetch('/api/ingest/hero-image', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    const { base64, mimeType } = await res.json() as { base64: string; mimeType: string };
    onChange(base64, mimeType);
    closeMenu();
  } catch (err) {
    setErrorMsg(err instanceof Error ? err.message : 'Failed to load image.');
    setMenuState('url-input');
  }
}
```

- [ ] **Step 3: Update the URL input placeholder**

Find:
```tsx
placeholder="https://example.com/image.jpg"
```
Change to:
```tsx
placeholder="recipe page URL or direct image URL"
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @eat/web test -- --reporter=verbose RecipeImagePicker
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/RecipesPage/RecipeImagePicker.tsx apps/web/src/pages/RecipesPage/RecipeImagePicker.test.tsx
git commit -m "feat: image picker URL input extracts og:image from page URLs via server"
```

---

## Self-review checklist

After all tasks:
- [ ] Run `pnpm --filter @eat/server test` — all server tests pass.
- [ ] Run `pnpm --filter @eat/web test` — all web tests pass.
- [ ] Spec coverage: server endpoint handles both image URLs and HTML pages ✓; frontend uses endpoint ✓; placeholder updated ✓.
