// Behavioural test for sequential customer-facing order numbers.
//
// OFFLINE ONLY. This never opens a network connection, never contacts Supabase
// and never touches a real database. The compiled lib/orders-store.ts is driven
// through an injected fake client, so only the real allocation logic runs.
//
// The cases that matter are the ones a source-level grep cannot prove:
//   1. numbers start at 1001 and increase by one
//   2. a replayed submission returns the SAME number and creates no new row
//   3. a lost race for a number is retried, not failed
//   4. eight concurrent orders never share a number
//   5. the UUID - not the sequential number - is the idempotency key
//   6. checkout still works before migration 003 adds the column
//
// Run: node scripts/test-order-numbers.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const outDir = mkdtempSync(join(root, '.order-number-test-'));
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const compiled = join(outDir, 'lib', 'orders-store.js');

try {
  execFileSync(
    process.execPath,
    [
      tsc,
      join(root, 'lib', 'orders-store.ts'),
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
  console.error('lib/orders-store.ts failed to compile - the numbering tests cannot run:');
  console.error(err.stdout || err.message);
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

if (!existsSync(compiled)) {
  console.error('tsc did not emit orders-store.js - cannot run the numbering tests.');
  rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
}

// Leave no build artefacts behind, however this run ends.
process.on('exit', () => rmSync(outDir, { recursive: true, force: true }));

let passed = 0;
let failed = 0;
function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log('PASS  ' + name);
  } else {
    failed++;
    console.log('FAIL  ' + name + (detail ? ' -> ' + detail : ''));
  }
}


// ---------------------------------------------------------------------------
// Fake Supabase client exposing the chained surface lib/orders-store.ts uses.
//
// `hasColumn` models the two real states this code must survive: migration 003
// applied (order_number exists, UNIQUE enforced) and not yet applied (the column
// is missing and any query naming it errors). Both are tested, because this
// code ships before the migration is run.
//
// Inserts are serialised through a promise chain so a unique-index collision is
// deterministic. Without it two "concurrent" calls could interleave
// unpredictably and the retry test would flake.
// ---------------------------------------------------------------------------
function makeClient({ hasColumn = true } = {}) {
  const rows = [];
  const events = [];
  let tail = Promise.resolve();
  const run = (fn) => (tail = tail.then(fn, fn));

  const noColumn = (col) => ({ code: '42703', message: `column orders.${col} does not exist` });
  const uniq = (constraint) => ({
    code: '23505',
    message: `duplicate key value violates unique constraint "${constraint}"`,
  });

  return {
    rows,
    events,
    // Force the next N inserts to fail the unique index, simulating the race
    // where two checkouts read the same MAX before either commits.
    failNextInserts: 0,

    from(table) {
      if (table !== 'orders') throw new Error('unexpected table: ' + table);
      const b = { _filters: {}, _missingCol: null };

      b.select = () => b;
      b.not = (col) => { b._missingCol = col; return b; };
      b.order = (col) => { b._orderCol = col; return b; };
      b.limit = (n) => { b._limit = n; return b; };
      b.eq = (col, val) => { b._filters[col] = val; return b; };

      // The counter query ends at .limit(1) with no .single(), so the builder
      // itself is awaited. It has to be a thenable or the read never resolves
      // and nextOrderNumber() sees undefined, which looks like "no rows yet".
      b.then = (onOk, onErr) => run(() => {
        if (b._missingCol && !hasColumn) return { data: null, error: noColumn(b._missingCol) };
        if (b._orderCol === 'order_number') {
          const nums = rows.map((r) => r.order_number).filter((n) => n != null);
          if (!nums.length) return { data: null, error: null };
          return { data: [{ order_number: Math.max(...nums) }], error: null };
        }
        return { data: [], error: null };
      }).then(onOk, onErr);

      // Highest order_number, or null when the table has none / column absent.
      b.maybeSingle = () => run(() => {
        if (b._missingCol && !hasColumn) return { data: null, error: noColumn(b._missingCol) };
        if (b._filters.id !== undefined) {
          const hit = rows.find((r) => r.id === b._filters.id);
          return { data: hit || null, error: null };
        }
        if (b._orderCol === 'order_number') {
          const nums = rows.map((r) => r.order_number).filter((n) => n != null);
          if (!nums.length) return { data: null, error: null };
          return { data: { order_number: Math.max(...nums) }, error: null };
        }
        return { data: null, error: null };
      });

      const self = this;
      b.insert = (newRows) => {
        const promise = run(() => {
          const row = { ...newRows[0] };

          // The column does not exist yet -> Postgres rejects the statement.
          if (!hasColumn && 'order_number' in row) {
            events.push('column-missing');
            return { data: null, error: noColumn('order_number') };
          }

          if (self.failNextInserts > 0) {
            self.failNextInserts--;
            events.push('forced-race');
            return { data: null, error: uniq('orders_order_number_key') };
          }

          if (rows.some((r) => r.id === row.id)) {
            events.push('dup-id');
            return { data: null, error: uniq('orders_pkey') };
          }
          if (row.order_number != null && rows.some((r) => r.order_number === row.order_number)) {
            events.push('dup-number');
            return { data: null, error: uniq('orders_order_number_key') };
          }

          rows.push(row);
          events.push('inserted');
          return { data: row, error: null };
        });

        return { select: () => ({ single: () => promise }) };
      };

      return b;
    },
  };
}

const require = createRequire(join(outDir, 'noop.js'));
const adminModule = require(join(outDir, 'lib', 'supabase-admin.js'));

/**
 * Swaps in a fake client and re-requires the store.
 *
 * The compiled store reads `adminSupabase` through a live module binding, so
 * overwriting the export on the admin module is enough - no source patching. The
 * require cache is cleared so each case starts from a clean module instance.
 */
function withClient(client, fn) {
  delete require.cache[require.resolve(compiled)];
  adminModule.adminSupabase = client;
  return fn(require(compiled));
}

function order(id, over = {}) {
  return {
    id,
    date: '2026-10-01',
    customer: 'Test Customer',
    email: 'test@example.com',
    phone: '9800000000',
    address: 'Test Address',
    city: 'Kathmandu',
    items: 1,
    total: 500,
    status: 'pending',
    items_data: [],
    ...over,
  };
}

async function run() {
  const { FIRST_ORDER_NUMBER } = require(compiled);
  check('the documented first number is 1001', FIRST_ORDER_NUMBER === 1001, String(FIRST_ORDER_NUMBER));

  // ---- 1. Sequential, dense, starting at 1001 -----------------------------
  {
    const client = makeClient();
    await withClient(client, async (store) => {
      const a = await store.addOrderIdempotent(order('uuid-a'));
      const b = await store.addOrderIdempotent(order('uuid-b'));
      const c = await store.addOrderIdempotent(order('uuid-c'));

      check('first order is numbered 1001', a.orderNumber === 1001, String(a.orderNumber));
      check('second order is numbered 1002', b.orderNumber === 1002, String(b.orderNumber));
      check('third order is numbered 1003', c.orderNumber === 1003, String(c.orderNumber));
      check('all three orders were saved', client.rows.length === 3, String(client.rows.length));
    });
  }

  // ---- 2. A replay returns the SAME number, creating no second row ---------
  {
    const client = makeClient();
    await withClient(client, async (store) => {
      const first = await store.addOrderIdempotent(order('uuid-same'));
      const replay = await store.addOrderIdempotent(order('uuid-same'));

      check('the replay is reported as a duplicate', replay.duplicate === true);
      check('the replay returns the original number', replay.orderNumber === first.orderNumber,
        `${replay.orderNumber} vs ${first.orderNumber}`);
      check('the replay created no second row', client.rows.length === 1, String(client.rows.length));
    });
  }

  // ---- 3. A lost race for a number is retried, not failed -----------------
  {
    const client = makeClient();
    await withClient(client, async (store) => {
      await store.addOrderIdempotent(order('uuid-seed'));
      client.failNextInserts = 1; // another checkout grabs 1002 first

      const res = await store.addOrderIdempotent(order('uuid-racer'));

      check('the order still saves after losing the number race', res.saved === true, JSON.stringify(res));
      check('it is not misreported as a duplicate', res.duplicate === false);
      // The retry re-reads the counter rather than adding an offset, so it
      // reclaims 1002 - the number the loser never actually took. Jumping to
      // 1003 would permanently burn 1002 and leave a hole in the sequence.
      check('the retry reclaims the number that was never taken',
        res.orderNumber === 1002, String(res.orderNumber));
      check('the race was actually exercised', client.events.includes('forced-race'));
      check('no two orders share a number',
        new Set(client.rows.map((r) => r.order_number)).size === client.rows.length);
      check('the sequence has no holes',
        JSON.stringify(client.rows.map((r) => r.order_number).sort((x, y) => x - y))
          === JSON.stringify([1001, 1002]));
    });
  }

  // ---- 4. Concurrent orders all get distinct numbers -----------------------
  {
    const client = makeClient();
    await withClient(client, async (store) => {
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => store.addOrderIdempotent(order(`uuid-conc-${i}`))),
      );

      const numbers = results.map((r) => r.orderNumber);
      check('every concurrent order saved', results.every((r) => r.saved));
      check('every concurrent order got a number', numbers.every((n) => n != null));
      check('no two concurrent orders share a number',
        new Set(numbers).size === numbers.length, JSON.stringify(numbers));
      check('8 rows were written', client.rows.length === 8, String(client.rows.length));
    });
  }

  // ---- 5. The UUID stays the idempotency key, not the sequential number ----
  {
    const client = makeClient();
    await withClient(client, async (store) => {
      const a = await store.addOrderIdempotent(order('uuid-1'));
      const b = await store.addOrderIdempotent(order('uuid-2'));

      // This is the property that stops a guessable 1001 from ever returning
      // another customer's order: identity is the random UUID, never the number.
      const rowA = client.rows.find((r) => r.id === 'uuid-1');
      const rowB = client.rows.find((r) => r.id === 'uuid-2');
      check('the stored id is the UUID, not the number',
        rowA.id === 'uuid-1' && rowB.id === 'uuid-2');
      check('UUIDs are unrelated to the numbers',
        rowA.id !== String(a.orderNumber) && rowB.id !== String(b.orderNumber));
      check('the two customers got different numbers', a.orderNumber !== b.orderNumber);
    });
  }

  // ---- 6. Works BEFORE migration 003 is applied ---------------------------
  {
    const client = makeClient({ hasColumn: false });
    await withClient(client, async (store) => {
      const res = await store.addOrderIdempotent(order('uuid-premigration'));

      check('checkout still saves before the column exists', res.saved === true, JSON.stringify(res));
      check('it reports no number rather than a broken one', res.orderNumber == null, String(res.orderNumber));
      check('the order row was still written', client.rows.length === 1, String(client.rows.length));
      // The counter read fails, so the row must be written WITHOUT the column
      // rather than being rejected for naming a column that does not exist.
      check('the row was written without the missing column',
        !('order_number' in client.rows[0]), JSON.stringify(client.rows[0]));
    });
  }

  console.log('');
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('ALL ORDER-NUMBER TESTS PASSED');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
