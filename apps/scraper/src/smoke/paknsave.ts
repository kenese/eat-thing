import 'dotenv/config';
import { chromium } from 'playwright';
import { loadStorageState } from '../session.js';
import { parseSearchResults, isLoggedOutPage } from '../stores/paknsave.js';

const HOUSEHOLD = process.env.SMOKE_HOUSEHOLD_ID;
const QUERY = process.argv[2] ?? 'eggs';

async function main() {
  if (!HOUSEHOLD) throw new Error('SMOKE_HOUSEHOLD_ID env var required');
  const storageState = await loadStorageState(HOUSEHOLD, 'paknsave');
  if (!storageState) throw new Error('No stored session for paknsave. Run bootstrap first.');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  await page.goto(`https://www.paknsave.co.nz/shop/search?q=${encodeURIComponent(QUERY)}`, { waitUntil: 'domcontentloaded' });
  const html = await page.content();

  if (isLoggedOutPage(html)) {
    console.error('Session expired. Re-run bootstrap.');
    process.exit(2);
  }

  const results = parseSearchResults(html);
  console.log(`Got ${results.length} results for "${QUERY}":`);
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
