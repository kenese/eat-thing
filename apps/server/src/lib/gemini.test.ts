import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateGeminiJson } from './gemini.js';

describe('gemini helpers', () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalKey;
    process.env.GEMINI_MODEL = originalModel;
    vi.restoreAllMocks();
  });

  it('requests JSON text from Gemini using GEMINI_API_KEY', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL = 'gemini-test-model';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"name":"Pasta"}' }] } }],
      }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await generateGeminiJson<{ name: string }>('Return a recipe.');

    expect(result).toEqual({ name: 'Pasta' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent?key=test-key',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"response_mime_type":"application/json"'),
      }),
    );
  });

  it('sends image data as an inline data part', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
      }),
    });
    globalThis.fetch = fetchMock as typeof fetch;

    await generateGeminiJson<{ ok: boolean }>('Read this image.', {
      image: { data: 'abc123', mimeType: 'image/jpeg' },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.contents[0].parts).toEqual([
      { text: 'Read this image.' },
      { inline_data: { mime_type: 'image/jpeg', data: 'abc123' } },
    ]);
  });
});
