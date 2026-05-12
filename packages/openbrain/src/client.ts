import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface OpenBrainThought {
  id: string;
  content: string;
  external_id?: string;
  type?: string;
  topic?: string;
  created_at?: string;
  [key: string]: unknown;
}

let _client: Client | null = null;
const TEXT_THOUGHT_ID_PREFIX = 'openbrain-text:';

export async function getOpenBrainClient(): Promise<Client> {
  if (_client) return _client;

  const transport = new StdioClientTransport({
    command: process.env.OPENBRAIN_COMMAND ?? 'npx',
    args: (process.env.OPENBRAIN_ARGS ?? '@open-brain/server').split(' '),
    env: {
      ...process.env as Record<string, string>,
      OPEN_BRAIN_API_KEY: process.env.OPENBRAIN_API_KEY ?? '',
    },
  });

  _client = new Client({ name: 'eat-thing', version: '1.0.0' });
  await _client.connect(transport);
  return _client;
}

function parseSseJson(text: string): unknown {
  const data = text
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trim())
    .join('\n')
    .trim();

  return JSON.parse(data || text);
}

async function callHttpTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const baseUrl = process.env.OPENBRAIN_BASE_URL;
  const apiKey = process.env.OPENBRAIN_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('OPENBRAIN_BASE_URL and OPENBRAIN_API_KEY are required');

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-brain-key': apiKey,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`OpenBrain HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const parsed = parseSseJson(body) as { result?: unknown; error?: { message?: string } };
  if (parsed.error) throw new Error(parsed.error.message ?? 'OpenBrain tool call failed');
  return parsed.result;
}

export async function upsertThought(externalId: string, content: string): Promise<void> {
  const client = await getOpenBrainClient();
  await client.callTool({
    name: 'upsert_thought',
    arguments: { external_id: externalId, content },
  });
}

function parseThoughtResult(result: unknown): OpenBrainThought[] {
  const blocks = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const text = blocks.find(b => b.type === 'text')?.text;
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as OpenBrainThought[];
    if (Array.isArray(parsed?.thoughts)) return parsed.thoughts as OpenBrainThought[];
    return [];
  } catch {
    return parseTextThoughts(text);
  }
}

function textThoughtId(content: string): string {
  return `${TEXT_THOUGHT_ID_PREFIX}${Buffer.from(content, 'utf8').toString('base64url')}`;
}

function parseTextThoughts(text: string): OpenBrainThought[] {
  if (/^No thoughts found/i.test(text.trim())) return [];

  const resultSections = text
    .split(/\n--- Result \d+ \([^)]+\) ---\n/g)
    .slice(1);

  return resultSections
    .map(section => section.replace(/^Captured: .*\n/i, '').replace(/^Type: .*\n/i, '').replace(/^Topics: .*\n/i, '').replace(/^People: .*\n/i, '').trim())
    .filter(Boolean)
    .map(content => ({ id: textThoughtId(content), content }));
}

// TODO(per-user-openbrain): when per-user accounts are supported, accept an API key here
export async function searchThoughts(query: string, options?: { limit?: number; threshold?: number }): Promise<OpenBrainThought[]> {
  if (process.env.OPENBRAIN_BASE_URL) {
    const result = await callHttpTool('search_thoughts', {
      query,
      limit: options?.limit ?? 100,
      ...(options?.threshold === undefined ? {} : { threshold: options.threshold }),
    });
    return parseThoughtResult(result);
  }

  const client = await getOpenBrainClient();
  const result = await client.callTool({
    name: 'search_thoughts',
    arguments: { query, limit: options?.limit ?? 100, threshold: options?.threshold },
  });
  return parseThoughtResult(result);
}

export async function fetchThought(id: string): Promise<OpenBrainThought | null> {
  if (id.startsWith(TEXT_THOUGHT_ID_PREFIX)) {
    const content = Buffer.from(id.slice(TEXT_THOUGHT_ID_PREFIX.length), 'base64url').toString('utf8');
    return { id, content };
  }

  if (process.env.OPENBRAIN_BASE_URL) {
    const result = await callHttpTool('fetch', { id });
    const blocks = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
    const text = blocks.find(b => b.type === 'text')?.text;
    if (!text) return null;
    try {
      return JSON.parse(text) as OpenBrainThought;
    } catch {
      return null;
    }
  }

  const client = await getOpenBrainClient();
  const result = await client.callTool({ name: 'fetch', arguments: { id } });
  const blocks = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const text = blocks.find(b => b.type === 'text')?.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as OpenBrainThought;
  } catch {
    return null;
  }
}
