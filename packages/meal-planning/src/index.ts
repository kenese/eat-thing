import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface MealPlannerIngredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface MealPlannerRecipe {
  id: string;
  name: string;
  cuisine?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  servings?: number | null;
  ingredients: MealPlannerIngredient[];
  instructions?: string[] | null;
  tags?: string[];
  rating?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface SearchRecipesOptions {
  query?: string;
  cuisine?: string;
  ingredient?: string;
  tag?: string;
}

let _client: Client | null = null;

async function getMealPlanningClient(): Promise<Client> {
  if (_client) return _client;

  const transport = new StdioClientTransport({
    command: process.env.MEAL_PLANNING_COMMAND ?? 'npx',
    args: (process.env.MEAL_PLANNING_ARGS ?? '@open-brain/meal-planning-server').split(' '),
    env: process.env as Record<string, string>,
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
  const baseUrl = process.env.MEAL_PLANNING_BASE_URL;
  const apiKey = process.env.MEAL_PLANNING_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('MEAL_PLANNING_BASE_URL and MEAL_PLANNING_API_KEY are required');

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
    throw new Error(`Meal Planning HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const parsed = parseSseJson(body) as { result?: unknown; error?: { message?: string } };
  if (parsed.error) throw new Error(parsed.error.message ?? 'Meal Planning tool call failed');
  return parsed.result;
}

function parseToolTextResult<T>(result: unknown, toolName: string): T {
  const blocks = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  const text = blocks.find(b => b.type === 'text')?.text;
  if (!text) throw new Error(`Meal Planning tool ${toolName} returned no text content`);
  return JSON.parse(text) as T;
}

export async function callMealPlanningTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (process.env.MEAL_PLANNING_BASE_URL) {
    const result = await callHttpTool(name, args);
    return parseToolTextResult<T>(result, name);
  }

  const client = await getMealPlanningClient();
  const result = await client.callTool({ name, arguments: args });
  return parseToolTextResult<T>(result, name);
}

export async function searchRecipes(options: SearchRecipesOptions = {}): Promise<MealPlannerRecipe[]> {
  return callMealPlanningTool<MealPlannerRecipe[]>('search_recipes', { ...options });
}
