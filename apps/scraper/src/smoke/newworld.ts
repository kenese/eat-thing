import 'dotenv/config';
import { chromium } from 'playwright';
import { loadStorageState } from '../session.js';
import { parseSearchResults, isLoggedOutPage, newWorldAdapter } from '../stores/newworld.js';
import type { ScraperJob } from '../worker-sdk/types.js';

const HOUSEHOLD = process.env.SMOKE_HOUSEHOLD_ID;
const mode = process.argv[2] ?? 'search';

async function main() {
  if (!HOUSEHOLD) throw new Error('SMOKE_HOUSEHOLD_ID env var required');

  if (mode === 'cart') {
    const sku = process.env.SMOKE_NW_SKU ?? '5037021';
    const itemPayload = {
      shoppingListId: 'smoke-list',
      items: [{ shoppingListItemId: 'smoke-item', sku, qty: 1 }],
    };
    const job: ScraperJob = {
      id: 'smoke-cart',
      householdId: HOUSEHOLD,
      store: 'new_world',
      type: 'add_to_cart',
      payload: itemPayload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    const browser = await chromium.launch({ headless: true });
    const result = await newWorldAdapter.handle(job, browser);
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
    return;
  }

  // Default: search mode
  const query = process.argv[3] ?? 'eggs';

  const storageState = await loadStorageState(HOUSEHOLD, 'new_world');
  if (!storageState) throw new Error('No stored session for new_world. Run bootstrap first.');

  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({ storageState });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();

  await page.goto(`https://www.newworld.co.nz/shop/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('p[data-testid="product-title"]', { timeout: 30000 }).catch(() => {
    console.warn('Warning: product-title never appeared — page may still be loading');
  });
  const html = await page.content();

  if (isLoggedOutPage(html)) {
    console.error('Session expired. Re-run bootstrap.');
    process.exit(2);
  }

  const results = parseSearchResults(html);
  console.log(`Got ${results.length} results for "${query}":`);
  for (const r of results.slice(0, 5)) {
    console.log(`  ${r.sku} ${r.name} (${r.brand ?? '?'}) $${r.price} ${r.inStock ? 'ok' : 'OOS'}`);
  }

  if (results.length === 0) {
    console.error('Zero results — selectors may be stale. Check fixtures README.');
    process.exit(3);
  }

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
