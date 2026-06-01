import { describe, expect, it, vi } from 'vitest';

vi.mock('./food-matcher.js', () => ({
  matchIngredients: vi.fn(async (names: string[]) =>
    names.map(() => ({ canonicalFoodId: null, foodName: null, confidence: 'low' as const }))
  ),
}));

vi.mock('./gemini.js', () => ({
  generateGeminiJson: vi.fn(),
}));

const { parseSchemaOrg, annotateMetric, resolveHeroImage, extractFromUrl } = await import('./recipe-extractor.js');

describe('parseSchemaOrg', () => {
  it('returns null when no ld+json script is present', () => {
    expect(parseSchemaOrg('<html><body>No schema here</body></html>')).toBeNull();
  });

  it('extracts a flat Recipe node', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Recipe',
      name: 'Simple Soup',
      recipeYield: '4',
      recipeIngredient: ['1 cup water', '1 tsp salt'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil water.' }],
    })}</script>`;
    const result = parseSchemaOrg(html);
    expect(result?.name).toBe('Simple Soup');
    expect(result?.servings).toBe(4);
    expect(result?.ingredients).toHaveLength(2);
    expect(result?.instructions).toBe('Boil water.');
  });

  it('handles HowToSection in recipeInstructions', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Recipe',
      name: 'Layered Cake',
      recipeYield: '8',
      recipeIngredient: ['200g flour'],
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'For the batter',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Mix flour and eggs.' },
            { '@type': 'HowToStep', text: 'Pour into tin.' },
          ],
        },
        {
          '@type': 'HowToSection',
          name: 'For the icing',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Beat butter and sugar.' },
          ],
        },
      ],
    })}</script>`;
    const result = parseSchemaOrg(html);
    expect(result?.instructions).toContain('## For the batter');
    expect(result?.instructions).toContain('Mix flour and eggs.');
    expect(result?.instructions).toContain('## For the icing');
    expect(result?.instructions).toContain('Beat butter and sugar.');
  });

  it('finds Recipe inside @graph array', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@graph': [
        { '@type': 'WebPage', name: 'My blog' },
        { '@type': 'Recipe', name: 'Graph Pasta', recipeYield: '2', recipeIngredient: ['100g pasta'], recipeInstructions: 'Boil.' },
      ],
    })}</script>`;
    const result = parseSchemaOrg(html);
    expect(result?.name).toBe('Graph Pasta');
  });
});

describe('annotateMetric', () => {
  it('converts known volume units', () => {
    const result = annotateMetric([{ name: 'water', qty: '1', unit: 'cup' }]);
    expect(result[0].metric).toBe('250 ml');
  });

  it('converts known mass units', () => {
    const result = annotateMetric([{ name: 'butter', qty: '1', unit: 'oz' }]);
    expect(result[0].metric).toBe('28.3 g');
  });

  it('converts tablespoons', () => {
    const result = annotateMetric([{ name: 'oil', qty: '1', unit: 'tbsp' }]);
    expect(result[0].metric).toBe('15 ml');
  });

  it('converts teaspoons', () => {
    const result = annotateMetric([{ name: 'salt', qty: '1', unit: 'tsp' }]);
    expect(result[0].metric).toBe('5 ml');
  });

  it('returns null for unconvertible quantities', () => {
    const result = annotateMetric([
      { name: 'pepper', qty: 'pinch', unit: '' },
      { name: 'herbs', qty: 'a sprig', unit: '' },
    ]);
    expect(result[0].metric).toBeNull();
    expect(result[1].metric).toBeNull();
  });

  it('preserves section field', () => {
    const result = annotateMetric([{ name: 'milk', qty: '1', unit: 'cup', section: 'For the sauce' }]);
    expect(result[0].section).toBe('For the sauce');
    expect(result[0].metric).toBe('250 ml');
  });
});

describe('resolveHeroImage', () => {
  it('returns og:image URL', () => {
    const html = `<html><head><meta property="og:image" content="https://example.com/hero.jpg"></head></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBe('https://example.com/hero.jpg');
  });

  it('returns twitter:image when og:image is absent', () => {
    const html = `<html><head><meta name="twitter:image" content="https://example.com/tweet.jpg"></head></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBe('https://example.com/tweet.jpg');
  });

  it('falls back to first photo img tag', () => {
    const html = `<html><body><img src="/images/recipe-photo.jpg" /></body></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBe('https://example.com/images/recipe-photo.jpg');
  });

  it('resolves relative og:image against base URL', () => {
    const html = `<html><head><meta property="og:image" content="/og/hero.png"></head></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBe('https://example.com/og/hero.png');
  });

  it('returns null when no image is found', () => {
    const html = `<html><body><p>No images here</p></body></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBeNull();
  });

  it('ignores data URIs in img tags', () => {
    const html = `<html><body><img src="data:image/png;base64,abc" /></body></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBeNull();
  });
});

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
