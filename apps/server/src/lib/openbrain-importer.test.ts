import { describe, expect, it, vi } from 'vitest';

vi.mock('@eat/openbrain', () => ({
  fetchThought: vi.fn(),
  searchThoughts: vi.fn(),
}));

vi.mock('./food-matcher.js', () => ({
  matchIngredients: vi.fn(),
}));

const { fetchThought, searchThoughts } = await import('@eat/openbrain');
const { matchIngredients } = await import('./food-matcher.js');
const { listOpenBrainRecipes, parseOpenBrainThought } = await import('./openbrain-importer.js');

describe('openbrain importer', () => {
  it('searches OpenBrain recipes with a low semantic threshold', async () => {
    vi.mocked(searchThoughts).mockResolvedValueOnce([
      {
        id: 'thought-1',
        content: "Recipe from the user's Evernote archive — Rib marinade.\n\n- 1/2 cup ketchup",
      },
    ]);

    const previews = await listOpenBrainRecipes(new Set());

    expect(searchThoughts).toHaveBeenCalledWith('recipe', { limit: 100, threshold: 0.1 });
    expect(previews).toEqual([
      {
        id: 'thought-1',
        title: 'Rib marinade',
        preview: '- 1/2 cup ketchup',
        alreadyImported: false,
      },
    ]);
  });

  it('preserves source URL from eat-thing markdown thoughts', async () => {
    vi.mocked(fetchThought).mockResolvedValueOnce({
      id: 'thought-1',
      content: [
        '# Recipe: Lemon Pasta',
        'Servings: 2',
        'Source: https://example.com/lemon-pasta',
        '',
        '## Ingredients',
        '- 200 g pasta',
        '',
        '## Instructions',
        'Boil pasta.',
      ].join('\n'),
    });
    vi.mocked(matchIngredients).mockResolvedValueOnce([
      {
        rawText: 'pasta',
        canonicalFoodId: 'food-1',
        foodName: 'pasta',
        canonicalDefaultUnit: null,
        confidence: 'high',
      },
    ]);

    const recipe = await parseOpenBrainThought('thought-1');

    expect(recipe.sourceUrl).toBe('https://example.com/lemon-pasta');
  });
});
