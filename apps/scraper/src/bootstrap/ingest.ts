import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { encrypt } from '../encryption.js';
import { postSession } from '../worker-sdk/client.js';
import type { Store } from '../worker-sdk/types.js';

interface Args { store: Store; household: string; file: string; }

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--store')       out.store     = argv[++i] as Store;
    else if (a === '--household') out.household = argv[++i] ?? '';
    else if (a === '--file')   out.file      = argv[++i] ?? '';
  }
  if (!out.store || !out.household || !out.file) {
    throw new Error('Usage: bootstrap:ingest --store new_world --household <UUID> --file <path>');
  }
  if (out.store !== 'new_world' && out.store !== 'paknsave' && out.store !== 'woolworths') {
    throw new Error(`Unknown store: ${out.store}`);
  }
  return out as Args;
}

async function main() {
  const { store, household, file } = parseArgs(process.argv.slice(2));
  const key = process.env.SUPERMARKET_ENC_KEY;
  if (!key) throw new Error('SUPERMARKET_ENC_KEY not set');

  const plaintext = readFileSync(file, 'utf8');
  JSON.parse(plaintext);

  const encryptedBlob = encrypt(plaintext, key);
  await postSession(household, store, encryptedBlob);

  console.log(`Session for household=${household} store=${store} ingested.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
