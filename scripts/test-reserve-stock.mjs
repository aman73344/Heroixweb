// Behavioural test for the reserveStock() all-or-nothing rollback.
//
// OFFLINE ONLY. This never opens a network connection, never contacts Supabase
// and never touches a real database: every case injects a fake client through
// the `deps.client` seam, so the only code exercised is lib/db.ts's own logic.
//
// Run: node scripts/test-reserve-stock.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// ---------------------------------------------------------------------------
// Compile the real lib/db.ts with the project's own TypeScript and run THAT.
// Compiling beats a hand-rolled TS->JS regex shim: the test exercises the exact
// source that ships, so the two TS errors this suite exists to guard (a missing
// `reserved`, an undefined `toReservationLine`) break the build here instead of
// being silently stripped away by a regex.
//
// The output goes to a temp dir INSIDE the project so Node's normal upward
// node_modules lookup still finds @supabase/supabase-js. It is removed again on
// the way out, including when the run fails.
// ---------------------------------------------------------------------------
const outDir = mkdtempSync(join(root, '.reserve-stock-test-'));
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const compiled = join(outDir, 'lib', 'db.js');

try {
  execFileSync(
    process.execPath,
    [
      tsc,
      join(root, 'lib', 'db.ts'),
      '--outDir', outDir,
      '--rootDir', root,
      '--module', 'commonjs',
      '--target', 'es2020',
      '--esModuleInterop',
      '--skipLibCheck',
      '--moduleResolution', 'node',
    ],
    { cwd: root, stdio: 'pipe', encoding: 'utf8' },
  );
} catch (err) {
  console.error('lib/db.ts failed to compile - the reservation tests cannot run:');
  console.error(err.stdout || err.message);
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

if (!existsSync(compiled)) {
  console.error('tsc did not emit lib/db.js - cannot run the reservation tests.');
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

// lib/db.ts imports ./supabase and ./supabase-admin, which are lazy Proxies:
// they build no connection at import time, so no env var is required and
// nothing dials out. Every query below goes through the injected fake client.
const require = createRequire(join(outDir, 'noop.js'));
const { reserveStock, releaseStock } = require(compiled);

// Leave no build artefacts behind, however this run ends.
process.on('exit', () => rmSync(outDir, { recursive: true, force: true }));

// ---------------------------------------------------------------------------
// Fake Supabase client exposing just the chained surface lib/db.ts uses:
// .from().select().eq().maybeSingle() and .from().eq().update().eq().select().
// `rpc` always reports the migration as unapplied, which drives the
// compare-and-swap fallback - the path the rollback lives on.
// ---------------------------------------------------------------------------
function makeClient(stocks, opts = {}) {
  const rows = new Map(Object.entries(stocks).map(([id, s]) => [id, { id, stock: s }]));
  const log = [];

  /** A filter node; every method returns a new node sharing the same rows. */
  const node = (filters, pending) => {
    const find = () =>
      [...rows.values()].find((r) => filters.every(([c, v]) => String(r[c]) === String(v)));

    // `pending` holds an update payload across the chain, so the real
    // `.update({...}).eq('id', p).eq('stock', s).select('stock')` order works
    // exactly as it does against PostgREST.
    const api = {
      select: () => api,
      eq: (col, val) => node([...filters, [col, val]], pending),
      maybeSingle: async () => {
        if (opts.readError) return { data: null, error: opts.readError };
        const hit = find();
        return { data: hit ? { ...hit } : null, error: null };
      },
      update: (payload) => node(filters, payload),
      then: (resolve, reject) => {
        // Awaiting the chain applies the write against every filter.
        if (!pending) return Promise.resolve({ data: [], error: null }).then(resolve, reject);

        const run = async () => {
          const target = find();
          // No row matched the guard: the compare-and-swap lost the race.
          if (!target) return { data: [], error: null };
          if (opts.writeError) return { data: null, error: opts.writeError };
          Object.assign(target, pending);
          log.push({ op: 'update', id: target.id, stock: target.stock });
          return { data: [{ stock: target.stock }], error: null };
        };
        return run().then(resolve, reject);
      },
    };
    return api;
  };

  return {
    log,
    stock: (id) => rows.get(id)?.stock,
    from: (table) => {
      if (table !== 'products') throw new Error(`unexpected table: ${table}`);
      return node([]);
    },
    // Migration 002 is assumed NOT applied, which is the staging default and the
    // path where the in-process rollback is what protects the stock.
    rpc: async (name) => {
      log.push({ op: 'rpc', name });
      return { data: null, error: { code: '42883', message: 'function does not exist' } };
    },
  };
}

let passed = 0;
let failed = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` -> ${extra}` : ''}`);
  ok ? (passed += 1) : (failed += 1);
};

const L = (productId, quantity, variant) => ({ productId, quantity, variant });

// --- 1. A single affordable line is reserved and reported ---------------------
{
  const c = makeClient({ a: 5 });
  const r = await reserveStock([L('a', 2)], { client: c });
  check('single line reserves', r.ok && c.stock('a') === 3, `stock=${c.stock('a')}`);
  check('success reports the reserved line', r.reserved.length === 1 && r.reserved[0].productId === 'a');
}

// --- 2. An unaffordable line was never taken, so it must not be credited back --
{
  const c = makeClient({ a: 1 });
  const r = await reserveStock([L('a', 5)], { client: c });
  check('insufficient stock fails', !r.ok && r.failures[0].available === 1);
  check('unreserved line is NOT credited back', c.stock('a') === 1, `stock=${c.stock('a')}`);
  check('nothing reported as still held', r.reserved.length === 0);
}

// --- 3. THE REGRESSION: line 1 succeeds, line 2 fails. Line 1 MUST be restored.
{
  const c = makeClient({ a: 10, b: 0 });
  const r = await reserveStock([L('a', 4), L('b', 1)], { client: c });
  check('partial failure reports the failure', !r.ok && r.failures.length === 1);
  check('already-reserved line is rolled back', c.stock('a') === 10, `stock=${c.stock('a')} (expected 10)`);
  check('failed line left untouched', c.stock('b') === 0, `stock=${c.stock('b')}`);
  check('nothing held after a clean rollback', r.reserved.length === 0);
}

// --- 4. Failure in the MIDDLE of a multi-item order: all holds restored ------
{
  const c = makeClient({ a: 10, b: 1, d: 10 });
  const r = await reserveStock([L('a', 3), L('b', 9), L('d', 2)], { client: c });
  check('mid-order failure names the failing line', !r.ok && r.failures[0].productId === 'b');
  check('line before the failure restored', c.stock('a') === 10, `stock=${c.stock('a')}`);
  check('line after the failure restored', c.stock('d') === 10, `stock=${c.stock('d')}`);
}

// --- 5. A fully successful multi-item order keeps every hold, and the caller's
//        releaseStock then returns all of them.
{
  const c = makeClient({ a: 10, b: 10 });
  const r = await reserveStock([L('a', 3), L('b', 2)], { client: c });
  check('multi-item success reserves all lines', r.ok && c.stock('a') === 7 && c.stock('b') === 8);
  check('multi-item success reports both lines', r.reserved.length === 2);

  await releaseStock(r.reserved, { client: c });
  check('releaseStock returns every reserved line', c.stock('a') === 10 && c.stock('b') === 10, `a=${c.stock('a')} b=${c.stock('b')}`);
}

// --- 6. Repeated lines for one product are each accounted for and restored ----
{
  const c = makeClient({ a: 10, b: 0 });
  await reserveStock([L('a', 2), L('a', 3), L('b', 1)], { client: c });
  check('both duplicate lines restored', c.stock('a') === 10, `stock=${c.stock('a')}`);
}

// --- 7. The design name survives into `reserved` and through the release ------
{
  const c = makeClient({ a: 10 });
  const r = await reserveStock([L('a', 1, 'Red')], { client: c });
  check('variant preserved in reserved', r.reserved[0]?.variant === 'Red', JSON.stringify(r.reserved[0]));
  await releaseStock(r.reserved, { client: c });
  check('variant line fully restored', c.stock('a') === 10, `stock=${c.stock('a')}`);
}

// --- 8. A read error fails closed and holds nothing --------------------------
{
  const c = makeClient({ a: 10, b: 10 }, { readError: { message: 'connection reset' } });
  const r = await reserveStock([L('a', 2), L('b', 2)], { client: c });
  check('read error fails closed', !r.ok && r.failures.length === 2);
  check('read error leaves no stock held', r.reserved.length === 0);
}

// --- 9. A write error fails closed --------------------------------------------
{
  const c = makeClient({ a: 10 }, { writeError: { message: 'deadlock detected' } });
  const r = await reserveStock([L('a', 2)], { client: c });
  check('write error fails closed', !r.ok && r.failures[0].available === 0);
  check('write error reports no hold', r.reserved.length === 0);
}

// --- 10. Empty / zero-quantity input is a no-op success -----------------------
{
  const c = makeClient({ a: 10 });
  const r = await reserveStock([L('', 3), L('a', 0)], { client: c });
  check('empty input is an ok no-op', r.ok && r.reserved.length === 0 && c.stock('a') === 10);
}

// --- 11. No order row is created when the reservation fails ------------------
// The fake client throws on any table other than `products`, so reaching for
// `orders` at all would fail this case.
{
  const c = makeClient({ a: 0 });
  const r = await reserveStock([L('a', 1)], { client: c });
  check('failed reservation never writes an order', !r.ok && c.log.every((e) => e.op !== 'rpc' || e.name === 'reserve_stock'));
}

// --- 12. releaseStock ignores empty/zero lines instead of crediting them -----
{
  const c = makeClient({ a: 7 });
  await releaseStock([L('', 5), L('a', 0), L('a', 2)], { client: c });
  check('releaseStock skips empty and zero lines', c.stock('a') === 9, `stock=${c.stock('a')} (expected 9)`);
}

console.log(`\n${failed === 0 ? 'ALL RESERVE-STOCK TESTS PASSED' : `${failed} TEST(S) FAILED`} (${passed} passed)`);
process.exit(failed === 0 ? 0 : 1);
