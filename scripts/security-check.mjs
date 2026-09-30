// Static security checks for the production-readiness work.
//
// These verify SOURCE-LEVEL guarantees without a running server or database.
// They guard against regressions - e.g. someone removing requireAdminApi() from
// a write route again.
//
// This script NEVER contacts production and NEVER writes to any database.
// Run: node scripts/security-check.mjs
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` -> ${extra}` : ''}`);
  if (!ok) failures += 1;
};

const read = (rel) => readFileSync(join(root, rel), 'utf8');

// --- 1. Every mutating route must call requireAdminApi() -----------------------
const MUTATING_ROUTES = [
  'app/api/products/route.ts',
  'app/api/admin-products/route.ts',
  'app/api/orders/route.ts',
];

for (const route of MUTATING_ROUTES) {
  check(`${route} guards admin writes`, read(route).includes('requireAdminApi'));
}

// POST /api/products specifically: the audit's most serious finding.
{
  const src = read('app/api/products/route.ts');
  const postIdx = src.indexOf('export async function POST');
  const guardIdx = src.indexOf('requireAdminApi()');
  check(
    'POST /api/products calls requireAdminApi() before doing any work',
    postIdx !== -1 && guardIdx > postIdx,
    guardIdx > postIdx ? 'guard is inside POST' : 'guard missing or misplaced',
  );
}

// --- 2. Debug write endpoints must be disabled in production ------------------
for (const route of ['app/api/test-db/route.ts', 'app/api/test-supabase/route.ts']) {
  const src = read(route);
  check(
    `${route} refuses production traffic`,
    src.includes('ALLOW_TEST_ENDPOINTS') && src.includes('410'),
  );
  check(
    `${route} double-guards NODE_ENV === 'production'`,
    src.includes("NODE_ENV === 'production'"),
  );
}

// --- 3. Rate limiting must exist on public endpoints --------------------------
const RATE_LIMITED = [
  ['app/api/orders/route.ts', 'POST /api/orders'],
  ['app/api/chat/route.ts', 'POST /api/chat'],
  ['app/api/products/route.ts', 'POST /api/products'],
  ['app/api/auth/login/route.ts', 'POST /api/auth/login'],
];
for (const [route, label] of RATE_LIMITED) {
  check(`${label} is rate limited`, read(route).includes('rateLimit('));
}

// --- 4. The limiter itself must be bounded (no unbounded Map) -----------------
{
  const src = read('lib/rate-limit.ts');
  check('rate limiter caps tracked keys (MAX_TRACKED_KEYS)', src.includes('MAX_TRACKED_KEYS'));
  check('rate limiter evicts expired buckets (sweep)', src.includes('sweep('));
}

// --- 5. The service-role key must never reach the browser ---------------------
// next.config.mjs `env` is inlined into the CLIENT bundle. Only the anon key
// may appear there.
{
  const cfg = read('next.config.mjs');
  const start = cfg.indexOf('env:');
  const envBlock = cfg.slice(start, cfg.indexOf('}', start));
  for (const secret of [
    'SUPABASE_SERVICE_KEY',
    'ADMIN_PASSWORD',
    'ADMIN_SESSION_SECRET',
    'OPENROUTER_API_KEY',
  ]) {
    check(`next.config env does NOT expose ${secret}`, !envBlock.includes(secret));
  }
}

// Server-only files may read the service key, but never a NEXT_PUBLIC_ variant.
for (const rel of ['app/api/admin-products/route.ts', 'app/api/products/route.ts']) {
  check(
    `${rel} does not read a NEXT_PUBLIC service key`,
    !read(rel).includes('NEXT_PUBLIC_SUPABASE_SERVICE_KEY'),
  );
}

// --- 6. Built client bundle must not contain the service key ------------------
// Skipped (not failed) when there is no build output or no local env file.
{
  const chunkDir = join(root, '.next', 'static', 'chunks');
  if (!existsSync(chunkDir)) {
    console.log('SKIP  service-key bundle scan (no .next build present)');
  } else {
    let secret = '';
    try {
      for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
        const i = line.indexOf('=');
        if (i > 0 && line.slice(0, i).trim() === 'SUPABASE_SERVICE_KEY') {
          secret = line.slice(i + 1).trim();
        }
      }
    } catch {
      /* no local env file */
    }

    if (!secret || secret.length <= 20) {
      console.log('SKIP  service-key bundle scan (no SUPABASE_SERVICE_KEY in .env.local)');
    } else {
      let leaked = false;
      const walk = (dir) => {
        for (const entry of readdirSync(dir)) {
          const p = join(dir, entry);
          if (statSync(p).isDirectory()) walk(p);
          else if (entry.endsWith('.js') && readFileSync(p, 'utf8').includes(secret)) {
            leaked = true;
          }
        }
      };
      walk(chunkDir);
      check('service key is NOT present in any client chunk', !leaked);
    }
  }
}

// --- 7. Checkout must not trust the client's price (Phase 2 guard) ------------
{
  const src = read('app/api/orders/route.ts');
  check(
    'POST /api/orders does not take the client total at face value',
    !/total:\s*body\.total/.test(src),
    'total is recomputed server-side',
  );
}

// --- 8. No server-side WRITE may use the anon-key client ---------------------
// This is the check that matters most for the RLS migration. `lib/supabase.ts`
// is built from the anon key; once anon write policies are revoked, any write
// still routed through it fails at runtime and breaks checkout.
const WRITE_FILES = [
  'lib/db.ts',
  'lib/server-products.ts',
  'app/api/products/route.ts',
];

for (const rel of WRITE_FILES) {
  const lines = read(rel).split(/\r?\n/);
  let anonWrites = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match a write verb, then confirm the client on that statement chain.
    if (!/\.(insert|upsert|update|delete)\s*\(/.test(line)) continue;

    // Walk back a few lines to find which client the chain starts from.
    const start = Math.max(0, i - 3);
    const chain = lines.slice(start, i + 1).join(' ');
    if (/\bsupabase\b(?!-admin)/.test(chain) && !/adminSupabase/.test(chain)) {
      anonWrites += 1;
      console.log(`      -> ${rel}:${i + 1}  ${line.trim()}`);
    }
  }
  check(`${rel} performs no writes via the anon client`, anonWrites === 0);
}

// --- 9. The service-key client must be guarded against client import ----------
{
  const src = read('lib/supabase-admin.ts');
  check(
    'supabase-admin throws if evaluated in a browser',
    src.includes("typeof window !== 'undefined'"),
  );
  check(
    'supabase-admin fails loudly when SUPABASE_SERVICE_KEY is missing',
    src.includes('SUPABASE_SERVICE_KEY'),
  );
}

// --- 10. Phase 2 checkout integrity -----------------------------------------
{
  const orders = read('app/api/orders/route.ts');
  const chat = read('app/api/chat/route.ts');
  const db = read('lib/db.ts');

  // Server must compute the price, never accept the client's.
  check(
    'POST /api/orders prices from the database',
    orders.includes('priceOrderFromDatabase'),
  );
  check('chat order also prices from the database', chat.includes('priceOrderFromDatabase'));
  check(
    'POST /api/orders never assigns body.total into the order',
    !/total:\s*body\.total/.test(orders) && !/total:\s*body\.?total/.test(orders),
  );

  // The full-orders-table read must be gone from the write path.
  const ordersPost = orders.slice(orders.indexOf('export async function POST'));
  check(
    'POST /api/orders no longer reads the whole orders table',
    !/getOrders\(\)/.test(ordersPost),
  );
  check(
    'chat order flow no longer reads the whole orders table',
    !/const orders = await getOrders\(\)/.test(chat),
  );

  // UUIDs, never Date.now() collisions.
  check(
    'order ids use crypto.randomUUID',
    orders.includes('crypto.randomUUID') && chat.includes('crypto.randomUUID'),
  );
  check(
    'no Date.now()-derived order id remains',
    !/ORD-\$\{Date\.now\(\)/.test(orders) && !/ORD-\$\{Date\.now\(\)/.test(chat),
  );

  // Idempotency.
  check('orders use the idempotent insert', orders.includes('addOrderIdempotent'));
  check('chat uses the idempotent insert', chat.includes('addOrderIdempotent'));
  check(
    'idempotent insert treats a PK collision as a replay',
    read('lib/orders-store.ts').includes('23505'),
  );

  // Atomic reservation before the order row is written.
  check('orders reserve stock before inserting', db.includes('reserveStock'));
  check(
    'orders release stock when the insert fails',
    orders.includes('releaseStock'),
  );
  check(
    'stock reservation uses a compare-and-swap guard',
    db.includes('.eq(\'stock\', current.stock)'),
  );
  check(
    'reservation fails closed on a database error',
    db.includes('Fail closed'),
  );

  // The all-or-nothing rollback. reserveStock returns ok:false with no order
  // created, so any line it DID decrement has to be put back inside
  // reserveStock - otherwise a partial failure drains stock permanently.
  check(
    'reserveStock records the lines it actually decremented',
    /reserved\.push\(\s*toReservationLine\(line\)\s*\)/.test(db),
  );
  check(
    'a failed reservation rolls its reserved lines back',
    // The success branch must return early, and the failure path must hand
    // `reserved` to the restore helper and report whatever is STILL held.
    /if \(failures\.length === 0\)[\s\S]*?return \{ ok: true, failures, reserved \};[\s\S]*?restoreLines\(\s*client,\s*reserved\s*[\s\S]*?reserved:\s*stillHeld\s*\}/.test(db),
  );
  check(
    'stock restore is guarded by the same compare-and-swap',
    /async function restoreLines[\s\S]*?\.eq\('stock', current\.stock\)/.test(db),
  );
  check(
    'no placeholder rollback writes stock 0',
    !/update\(\{\s*stock:\s*0\s*\}\)/.test(db),
    'a placeholder rollback would zero out live stock',
  );

  // Both order paths must release exactly what they reserved. Re-deriving the
  // line list from the request would credit back stock never taken.
  for (const [src, label] of [
    [orders, 'POST /api/orders'],
    [chat, 'chat order flow'],
  ]) {
    check(
      `${label} releases reservation.reserved`,
      /releaseStock\(\s*reservation\.reserved\s*\)/.test(src),
    );
    check(
      `${label} does not re-derive the release list from the request`,
      !/releaseStock\(\s*priced\.items\.map/.test(src),
    );
    check(
      `${label} returns before inserting when the reservation fails`,
      /if \(!reservation\.ok\)[\s\S]{0,600}return/.test(src),
    );
  }

  // The chat retry that used to create duplicate orders is gone.
  check(
    'chat no longer blindly retries the order insert',
    !/saved = await addOrder\(/.test(chat),
  );
}

console.log(failures === 0 ? '\nALL SECURITY CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
