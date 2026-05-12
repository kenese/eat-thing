import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchThought, searchThoughts } from './client.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('OpenBrain HTTP client', () => {
  it('calls the MCP endpoint with x-brain-key and parses SSE tool results', async () => {
    process.env.OPENBRAIN_BASE_URL = 'https://openbrain.example/mcp';
    process.env.OPENBRAIN_API_KEY = 'test-key';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => [
        'event: message',
        'data: {"result":{"content":[{"type":"text","text":"{\\"thoughts\\":[{\\"id\\":\\"thought-1\\",\\"content\\":\\"# Recipe: Pasta\\"}]}"}]},"jsonrpc":"2.0","id":1}',
        '',
      ].join('\n'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const thoughts = await searchThoughts('recipe', { limit: 1 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://openbrain.example/mcp',
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
        name: 'search_thoughts',
        arguments: { query: 'recipe', limit: 1 },
      },
    });
    expect(thoughts).toEqual([{ id: 'thought-1', content: '# Recipe: Pasta' }]);
  });

  it('parses human-readable search_thoughts results and can fetch them by synthetic id', async () => {
    process.env.OPENBRAIN_BASE_URL = 'https://openbrain.example/mcp';
    process.env.OPENBRAIN_API_KEY = 'test-key';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => [
        'event: message',
        'data: {"result":{"content":[{"type":"text","text":"Found 1 thought(s):\\n\\n--- Result 1 (37.6% match) ---\\nCaptured: 5/7/2026\\nType: reference\\nTopics: recipe, cooking\\n\\nRecipe from the user archive — Rib marinade.\\n\\n- 1/2 cup ketchup"}]},"jsonrpc":"2.0","id":1}',
        '',
      ].join('\n'),
    }));

    const thoughts = await searchThoughts('recipe', { limit: 1, threshold: 0.1 });
    const fetched = await fetchThought(thoughts[0].id);

    expect(thoughts).toHaveLength(1);
    expect(thoughts[0].content).toContain('Rib marinade');
    expect(thoughts[0].id).toMatch(/^openbrain-text:/);
    expect(fetched?.content).toBe(thoughts[0].content);
  });
});
