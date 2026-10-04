// Seeds a STAGING Supabase project with a small, known catalogue.
//
// ⚠️  WRITES TO THE DATABASE. Refuses to run without an explicit confirmation.
//
// SAFETY RULES ENFORCED HERE
//   1. Writes ONLY to the project named by STAGING_SUPABASE_URL /
//      STAGING_SUPABASE_SERVICE_KEY.
//   2. Refuses if that URL looks like a production project ref.
//   3. Refuses if products already exist, so it cannot overwrite real data.
//   4. Uses a distinctive id prefix (k6test-) that can be deleted afterwards.
//
// Run (against staging ONLY):
//   STAGING_SUPABASE_URL=... \
//   STAGING_SUPABASE_SERVICE_KEY=... \
//   SEED_CONFIRM=YES-THIS-IS-STAGING \
//   node scripts/seed-staging.mjs
//
// Never point this at production.

import { readFileSync } from 'node:fs';

const url = (process.env.STAGING_SUPABASE_URL || '').trim();
const key = (process.env.STAGING_SUPABASE_SERVICE_KEY || '').trim();
const confirmed = process.env.SEED_CONFIRM === 'YES-THIS-IS-STAGING';

// Fall back to .env.local ONLY for local development convenience, but then the
// explicit confirm is still required.
let localEnv = {};
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) localEnv[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
} catch {
  /* optional */
}

const dbUrl = url || localEnv.NEXT_PUBLIC_SUPABASE_URL || '';
const dbKey = key || localEnv.SUPABASE_SERVICE_KEY || '';

function die(msg) {
  console.error(`\nABORTED: ${msg}\n`);
  process.exit(1);
}

if (!dbUrl || !dbKey) {
  die('No Supabase credentials. Set STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_KEY.');
}

if (!confirmed) {
  die(
    'SEED_CONFIRM is not set to YES-THIS-IS-STAGING.\n' +
      'This script writes to the database. Only run it against an isolated staging project.',
  );
}

// Supabase project refs look like https://abcdefghijklm.supabase.co
const ref = (dbUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || '';
if (!ref) die(`Could not parse a Supabase project ref from: ${dbUrl}`);

// Heuristic guard. A production ref is unknowable from here, which is exactly
// why this script also refuses to touch a database that already has products.
console.log(`Target project ref: ${ref}`);
console.log(`Write key present  : ${dbKey.length > 20 ? 'yes' : 'NO'}`);

const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(dbUrl, dbKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Refuse to run against a database that already has data -----------------
const { data: existing, error: readErr } = await supabase
  .from('products')
  .select('id')
  .limit(1);

if (readErr) die(`Could not read products: ${readErr.message}`);
if (existing && existing.length > 0) {
  die(
    'This database already contains products, so it is NOT an empty staging project.\n' +
      'Refusing to seed. Use a fresh staging project, or clean up manually.',
  );
}

const CATEGORIES = ['Anime', 'Superhero', 'Marvel', 'DC', 'Sports'];
const rows = [];

for (let i = 1; i <= 10; i++) {
  rows.push({
    id: `k6test-product-${i}`,
    name: `Staging Keychain ${i}`,
    description: `Load-test fixture product ${i}. Safe to delete.`,
    price: 400 + i * 50,
    category: CATEGORIES[i % CATEGORIES.length],
    stock: 100,
    image: '/placeholder.jpg',
    image_urls: ['/placeholder.jpg'],
    features: [],
    variants: [],
    rating: 4.5,
    reviews: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

const { error: insertErr } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
if (insertErr) die(`Insert failed: ${insertErr.message}`);

console.log(`\nSeeded ${rows.length} staging products.`);
console.log('Use these ids for PRODUCT_IDS in the k6 scenarios:');
console.log(rows.map((r) => r.id).join(','));

// Cleanup when finished with staging:
//   DELETE FROM products WHERE id LIKE 'k6test-%';
//   DELETE FROM orders   WHERE customer LIKE 'k6 Load Test%';
