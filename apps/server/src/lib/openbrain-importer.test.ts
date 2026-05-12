import { describe, expect, it, vi } from 'vitest';

vi.mock('@eat/openbrain', () => ({
  fetchThought: vi.fn(),
  searchThoughts: vi.fn(),
}));

vi.mock('./food-matcher.js', () => ({
  matchIngredients: vi.fn(),
}));

const { fetchThought } = await import('@eat/openbrain');
const { matchIngredients } = await import('./food-matcher.js');
const { parseOpenBrainThought } = await import('./openbrain-importer.js');

describe('openbrain importer', () => {
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
        confidence: 'high',
      },
    ]);

    const recipe = await parseOpenBrainThought('thought-1');

    expect(recipe.sourceUrl).toBe('https://example.com/lemon-pasta');
  });
});
