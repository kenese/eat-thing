import 'dotenv/config';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';

const OUT_DIR = join(homedir(), '.eat-thing');
const OUT_FILE = join(OUT_DIR, 'paknsave-storage.json');
const USER_DATA_DIR = join(OUT_DIR, 'chrome-paknsave');
const LOGIN_URL = 'https://www.paknsave.co.nz/account/login';

function waitForEnter(prompt: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(prompt, () => { rl.close(); resolve(); }));
}

async function main() {
  console.log("Launching headed browser. Log in to Pak'nSave.");
  console.log('Storage state will be saved to:', OUT_FILE);

  mkdirSync(USER_DATA_DIR, { recursive: true });

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  await page.goto(LOGIN_URL);

  await waitForEnter('\nPress Enter here once you have logged in...');

  const storage = await context.storageState();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(storage));

  console.log('\nDone. Storage state saved.');
  console.log('Next run:');
  console.log(`  pnpm --filter @eat/scraper bootstrap:ingest --store paknsave --household <HOUSEHOLD_ID> --file ${OUT_FILE}`);

  await context.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
