export type GeminiImageInput = {
  data: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
};

type GeminiOptions = {
  image?: GeminiImageInput;
  maxOutputTokens?: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata: {
    totalTokenCount?: number;
  }
};

const DEFAULT_MODEL = 'gemini-2.0-flash';
const LOW_THINKING = 'low';
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed;
  const match = trimmed.match(/(?:\{[\s\S]*\}|\[[\s\S]*\])/);
  if (!match) throw new Error('Gemini did not return JSON');
  return match[0];
}

export async function generateGeminiJson<T>(prompt: string, options: GeminiOptions = {}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (options.image) {
    parts.push({
      inline_data: {
        mime_type: options.image.mimeType,
        data: options.image.data,
      },
    });
  }

  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      response_mime_type: 'application/json',
      max_output_tokens: options.maxOutputTokens ?? 8192,
      thinkingConfig: {
        thinkingLevel: LOW_THINKING
      }
    },
  });

  let res: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
    );
    if (res.ok || !RETRYABLE_STATUSES.has(res.status)) break;
    const errBody = await res.json().catch(() => null);
    lastError = errBody?.error ?? new Error(`Gemini request failed: ${res.status}`);
    console.log(`Gemini attempt ${attempt + 1} failed: ${res.status}`, lastError);
  }

  if (!res!.ok) {
    const errBody = await res!.json().catch((e) => e);
    const err = errBody?.error ?? lastError ?? new Error(`Gemini request failed: ${res!.status}`);
    console.log(`Gemini request failed: ${res!.status}`, err);
    throw err;
  }

  const json = await res.json() as GeminiResponse;
  if (json?.usageMetadata?.totalTokenCount && json.usageMetadata.totalTokenCount >= 8192) {
    console.log('LIKELY JSON NOT COMPLETE', json?.usageMetadata)
  }
  const text = json.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
  if (!text) throw new Error('Gemini returned no text');

  let parsed = JSON.parse(extractJsonText(text));
  return parsed instanceof Array ? parsed[0] : parsed
}
