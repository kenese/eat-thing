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
};

const DEFAULT_MODEL = 'gemini-flash-latest';
// const DEFAULT_MODEL = 'gemini-2.0-flash';

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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          response_mime_type: 'application/json',
          max_output_tokens: options.maxOutputTokens ?? 8192,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.json().catch((e) => {
      console.log('Gemini request failed json read', e);
    });
    const err = Object.assign(new Error(body?.error ?? `HTTP ${res.status}`), {
      status: res.status,
    });
    console.log(`Gemini request failed: ${res.status}${body ? ` ${body}` : err }`);
    throw new Error(`Gemini request failed: ${res.status}${body ? ` ${body}` : ''}`);
  }

  const json = await res.json() as GeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
  if (!text) throw new Error('Gemini returned no text');

  return JSON.parse(extractJsonText(text)) as T;
}
