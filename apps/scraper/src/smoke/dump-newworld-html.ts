import 'dotenv/config';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { loadStorageState } from '../session.js';

const HOUSEHOLD = process.env.SMOKE_HOUSEHOLD_ID;
const QUERY = process.argv[2] ?? 'eggs';
const OUT = process.argv[3] ?? '/tmp/newworld-dump.html';

async function main() {
  if (!HOUSEHOLD) throw new Error('SMOKE_HOUSEHOLD_ID env var required');
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

  await page.goto(`https://www.newworld.co.nz/shop/search?q=${encodeURIComponent(QUERY)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(3000);

  const html = await page.content();
  writeFileSync(OUT, html);
  console.log(`Saved ${html.length} bytes to ${OUT}`);

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
