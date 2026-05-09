import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

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
