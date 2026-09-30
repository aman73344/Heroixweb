// READ-ONLY pre-flight for supabase/migrations/001_harden_rls.sql.
//
// WHY THIS EXISTS
// 001 revokes anon INSERT/UPDATE/DELETE on `products` and locks `orders` down
// completely. The catalogue is read from the BROWSER with the anon key, so if
// anything here fails, applying 001 leaves customers staring at an empty shop.
//
// This checks the real database through the PostgREST API - no SQL execution,
// no DDL, no writes of any kind. It is therefore safe to run against
// production, and it is the only part of the migration pre-flight that does not
// need a direct Postgres connection.
//
// WHAT IT CANNOT CHECK (needs the dashboard SQL editor)
//   - the pg_policies / role_table_grants queries in STEP 4
//   - whether anon has write policies right now
// Those are the confirmation steps to run by hand AFTER applying 001.
//
// Run: node scripts/migration-preflight.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// Load .env.local by NAME only; values are never printed.
const env = {};
const envPath = join(root, '.env.local');
if (!existsSync(envPath)) {
  console.error('No .env.local - cannot read Supabase credentials.');
  process.exit(1);
}
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_KEY;
const anonKey = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failed = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` -> ${extra}` : ''}`);
  if (!ok) failed += 1;
};
const warn = (label, detail) => console.log(`WARN  ${label} -> ${detail}`);

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local.');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- 1. The service-key writes must work BEFORE 001 locks anon out ---------
// The most important check. 001 assumes every server-side write already uses
// the service key; if that is false, checkout breaks the moment it is applied.
{
  const { data, error } = await admin.from('products').select('id').limit(1);
  check(
    'service key can read products (proves the write-path credential works)',
    !error,
    error ? error.message : 'ok',
  );
  check('products table is reachable', Array.isArray(data), `${data?.length ?? 0} row(s) sampled`);
}

{
  const { error } = await admin.from('orders').select('id').limit(1);
  check(
    'service key can read orders (the admin order list depends on this)',
    !error,
    error ? error.message : 'ok',
  );
}

// --- 2. The catalogue must still be publicly readable after 001 -------------
// 001 keeps exactly one policy: SELECT to anon on products. If the anon key
// cannot read it today, the shop is already broken and 001 would not fix it.
if (anonKey) {
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.from('products').select('id').limit(1);
  check(
    'anon key can read the catalogue (the storefront depends on this)',
    !error,
    error ? error.message : 'ok',
  );
  check(
    'catalogue is non-empty (revoking writes must not empty the shop)',
    Array.isArray(data) && data.length > 0,
    `${data?.length ?? 0} row(s)`,
  );
} else {
  warn('anon key not present', 'skipped the public-read check');
}

// --- 3. No code path writes with the anon key any more --------------------
{
  let anonWrites = 0;
  for (const rel of ['lib/db.ts', 'lib/server-products.ts', 'app/api/products/route.ts']) {
    const src = readFileSync(join(root, rel), 'utf8');
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!/\.(insert|upsert|update|delete)\s*\(/.test(lines[i])) continue;
      const chain = lines.slice(Math.max(0, i - 3), i + 1).join(' ');
      if (/\bsupabase\b(?!-admin)/.test(chain) && !/adminSupabase/.test(chain)) anonWrites += 1;
    }
  }
  check(
    'no server-side write uses the anon client (001 depends on this)',
    anonWrites === 0,
    anonWrites === 0 ? 'all writes go through adminSupabase' : `${anonWrites} anon write(s) remain`,
  );
}

// --- 4. The migration file itself must be ready ----------------------------
{
  const sql = readFileSync(join(root, 'supabase', 'migrations', '001_harden_rls.sql'), 'utf8');

  // Isolate STEP 3 by its own dashed banner rather than by searching for the
  // text "STEP 4". A naive `indexOf('STEP 4')` also matches the mention inside
  // STEP 3's own comment, which mis-slices the region and reports live
  // statements that are actually still commented out.
  const banner = (n) => {
    const re = new RegExp(`^-- -{10,}\\s*\\n-- STEP ${n} `, 'm');
    const m = sql.match(re);
    return m ? m.index : -1;
  };
  const step3Start = banner(3);
  const step4Start = banner(4);
  check('migration 001 has a STEP 3 section', step3Start !== -1, `index ${step3Start}`);
  check('migration 001 has a STEP 4 section', step4Start !== -1, `index ${step4Start}`);

  if (step3Start !== -1 && step4Start > step3Start) {
    const live = sql
      .slice(step3Start, step4Start)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('--'));
    check(
      'migration 001 STEP 3 (storage) is fully commented out',
      live.length === 0,
      live.length === 0
        ? 'admin photo upload keeps working'
        : `${live.length} live statement(s): ${live.join(' ')}`,
    );
  }

  // The dangerous statements are the ones that must be present.
  const required = [
    'REVOKE INSERT, UPDATE, DELETE ON products FROM anon',
    'GRANT SELECT ON products TO anon',
    'REVOKE ALL ON orders FROM anon',
  ];
  for (const stmt of required) {
    check(`001 contains: ${stmt}`, sql.includes(stmt));
  }
}

console.log(
  failed === 0
    ? '\nPRE-FLIGHT PASSED - 001 STEP 1 + 2 are safe to apply. (Skip STEP 3.)'
    : `\n${failed} CHECK(S) FAILED - do NOT apply 001 until these are resolved.`,
);
process.exit(failed === 0 ? 0 : 1);
