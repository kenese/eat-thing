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

export async function getOpenBrainClient(): Promise<Client> {
  if (_client) return _client;

  const baseUrl = process.env.OPENBRAIN_BASE_URL;
  if (!baseUrl) throw new Error('OPENBRAIN_BASE_URL is not set');

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
    return [];
  }
}

// TODO(per-user-openbrain): when per-user accounts are supported, accept an API key here
export async function searchThoughts(query: string, options?: { limit?: number }): Promise<OpenBrainThought[]> {
  const client = await getOpenBrainClient();
  const result = await client.callTool({
    name: 'search_thoughts',
    arguments: { query, limit: options?.limit ?? 100 },
  });
  return parseThoughtResult(result);
}

export async function fetchThought(id: string): Promise<OpenBrainThought | null> {
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
