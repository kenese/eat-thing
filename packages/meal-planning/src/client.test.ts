import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchRecipes } from './index.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('Meal Planning MCP client', () => {
  it('calls the Meal Planning MCP search_recipes tool and parses JSON text content', async () => {
    process.env.MEAL_PLANNING_BASE_URL = 'https://meal-planning.example/mcp';
    process.env.MEAL_PLANNING_API_KEY = 'test-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                {
                  id: 'mp-1',
                  name: 'Lemon Pasta',
                  servings: 4,
                  ingredients: [{ name: 'spaghetti', quantity: '400', unit: 'g' }],
                  instructions: ['Boil pasta.', 'Toss with lemon.'],
                },
              ]),
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const recipes = await searchRecipes({ query: 'lemon' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://meal-planning.example/mcp',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-brain-key': 'test-key',
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      method: 'tools/call',
      params: {
        name: 'search_recipes',
        arguments: { query: 'lemon' },
      },
    });
    expect(recipes[0]).toMatchObject({
      id: 'mp-1',
      name: 'Lemon Pasta',
      servings: 4,
    });
  });
}
);
