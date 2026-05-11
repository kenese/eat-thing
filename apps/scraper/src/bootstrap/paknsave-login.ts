import 'dotenv/config';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OUT_DIR = join(homedir(), '.eat-thing');
const OUT_FILE = join(OUT_DIR, 'paknsave-storage.json');
const LOGIN_URL = 'https://www.paknsave.co.nz/account/login';

async function main() {
  console.log('Launching headed browser. Log in to Pak\'nSave, then wait.');
  console.log('Storage state will be saved to:', OUT_FILE);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL);

  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10 * 60 * 1000 });
  await page.waitForTimeout(2000);

  const storage = await context.storageState();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(storage));

  console.log('\nDone. Storage state saved.');
  console.log('Next: copy this file to the Mac mini, then run:');
  console.log(`  pnpm --filter @eat/scraper bootstrap:ingest --store paknsave --household <HOUSEHOLD_ID> --file ${OUT_FILE}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
