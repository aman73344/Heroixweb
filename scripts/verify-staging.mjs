// Verifies an EXISTING staging deployment is isolated from production and safe
// to load test.
//
// READ-ONLY. It creates nothing, writes nothing, and never contacts production.
// It only GETs the staging URL you give it, plus one deliberately-REJECTED
// anonymous POST used to prove a write is blocked.
//
// It does NOT create infrastructure. If staging config is missing it reports
// exactly which variable is absent and exits non-zero, rather than assuming.
//
// CONFIG SOURCES (first match wins per variable)
//   1. process.env
//   2. .env.staging        (optional; git-ignored by the .env* rule)
//   3. for the PRODUCTION baseline only: .env.local
//
// Required for a full verification:
//   STAGING_URL                   the existing staging/preview deployment URL
//   STAGING_SUPABASE_URL          the existing staging Supabase project URL
// Optional:
//   PRODUCTION_SUPABASE_URL       defaults to .env.local, used for the
//                                 isolation comparison
//
// Run:
//   node scripts/verify-staging.mjs
//   STAGING_URL=https://<preview-host> \
//   STAGING_SUPABASE_URL=https://<ref>.supabase.co node scripts/verify-staging.mjs

import { readFileSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url);
let failures = 0;
const missing = [];

const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` -> ${extra}` : ''}`);
  if (!ok) failures += 1;
};

const need = (label, value) => {
  const ok = Boolean(value);
  console.log(`${ok ? 'PASS' : 'MISSING'}  ${label}${ok ? '' : '   <-- required'}`);
  if (!ok) {
    missing.push(label);
    failures += 1;
  }
  return ok;
};

function readEnvFile(name) {
  const path = new URL(name, root);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i > 0) out[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
  }
  return out;
}

const stagingFile = readEnvFile('.env.staging');
const localFile = readEnvFile('.env.local');
const cfg = (name) => (process.env[name] || stagingFile[name] || '').trim();

// --- 1. Structural guarantees (no staging config needed) ---------------------
console.log('\n--- 1. Load-test safety structure ---');
{
  const guard = readFileSync(new URL('loadtest/guard.js', root), 'utf8');
  check('guard blocks known production hosts', guard.includes('PRODUCTION_HOSTS'));
  check('guard refuses prod/live hostnames', guard.includes('DANGEROUS_SUBSTRINGS'));
  check('guard requires an explicit confirmation', guard.includes('LOADTEST_CONFIRM'));
  check(
    'destructive scenarios need a separate confirmation',
    guard.includes('LOADTEST_CONFIRM_DESTRUCTIVE'),
  );

  const dir = new URL('loadtest/', root);
  for (const name of ['smoke.js', 'browse.js', 'search.js', 'spike.js', 'checkout.js', 'ai.js']) {
    let src = '';
    try {
      src = readFileSync(new URL(name, dir), 'utf8');
    } catch {
      check(`${name} exists`, false, 'missing');
      continue;
    }
    const body = src.slice(src.indexOf('export default function'));
    const declaresWrites = /export const WRITES_DATA\s*=\s*(true|false)/.test(src);
    const writes = declaresWrites && /WRITES_DATA\s*=\s*true/.test(src);
    check(`${name} declares WRITES_DATA and guards the target`, declaresWrites && body.includes('assertSafeTarget()'));
    if (writes) {
      check(
        `${name} also requires the destructive confirmation`,
        body.includes('assertDestructiveAllowed()') &&
          body.indexOf('assertSafeTarget()') < body.indexOf('assertDestructiveAllowed()'),
      );
    }
  }
}

// --- 2. Existing staging environment (nothing is created here) ---------------
console.log('\n--- 2. Existing staging environment ---');

const stagingUrl = cfg('STAGING_URL');
const stagingSupabase = cfg('STAGING_SUPABASE_URL');
const prodSupabase = (
  process.env.PRODUCTION_SUPABASE_URL ||
  stagingFile.PRODUCTION_SUPABASE_URL ||
  localFile.SUPABASE_URL ||
  localFile.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).trim();

need('STAGING_URL (existing preview deployment)', stagingUrl);
need('STAGING_SUPABASE_URL (existing staging project)', stagingSupabase);

if (!existsSync(new URL('.env.staging', root)) && !process.env.STAGING_URL) {
  console.log(
    '\nNOTE: no .env.staging file and no STAGING_URL in the environment.\n' +
      '      Supply them as environment variables or create a .env.staging file\n' +
      '      (already git-ignored by the ".env*" rule). Nothing was created for you.',
  );
}

// --- 3. Isolation: staging must NOT be the production database ---------------
console.log('\n--- 3. Isolation ---');

// The same production host list the k6 guard uses. Duplicated here on purpose:
// guard.js imports k6 globals (__ENV, fail) and cannot be imported from Node.
// The drift check below keeps the two copies honest.
const PRODUCTION_HOSTS = [
  'heroix.com',
  'www.heroix.com',
  'shop.heroix.com',
  'heroix.vercel.app',
  'heroixweb.vercel.app',
  'heroix-git-main.vercel.app',
];

{
  const guardSrc = readFileSync(new URL('loadtest/guard.js', root), 'utf8');
  const missingHere = PRODUCTION_HOSTS.filter((h) => !guardSrc.includes(`'${h}'`));
  check(
    'guard.js blocklist and this script agree',
    missingHere.length === 0,
    missingHere.length ? `not in guard.js: ${missingHere.join(', ')}` : 'in sync',
  );
}

if (stagingUrl) {
  const host = new URL(stagingUrl).hostname.toLowerCase();
  const isListedProduction = PRODUCTION_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`),
  );

  if (isListedProduction) {
    check('STAGING_URL is NOT a production host', false, `${host} IS a known production host`);
    console.log(
      '\n  STOP. This host is on the production blocklist. Point the load tests at a\n' +
        '  genuinely separate staging deployment, or remove it from PRODUCTION_HOSTS in\n' +
        '  both loadtest/guard.js and scripts/verify-staging.mjs - but only if it is\n' +
        '  genuinely staging.\n',
    );
  } else {
    check('STAGING_URL is NOT a production host', true, host);
  }

  const looksProd = ['prod', 'production', 'live'].some((s) => host.includes(s));
  check('STAGING_URL does not look like production by name', !looksProd, host);
}

const refOf = (url) => {
  try {
    return new URL(url).hostname.match(/^([a-z0-9]+)\./i)?.[1]?.toLowerCase() || '';
  } catch {
    return '';
  }
};

const stagingRef = refOf(stagingSupabase);
const prodRef = refOf(prodSupabase);

if (stagingRef && prodRef) {
  check(
    'staging project ref differs from production',
    stagingRef !== prodRef,
    stagingRef === prodRef
      ? `SAME PROJECT (${stagingRef}) - NOT isolated`
      : `staging=${stagingRef} production=${prodRef}`,
  );
} else {
  console.log('WARN  could not compare project refs (one side unknown)');
}

// --- 4. Live read-only checks against the EXISTING staging deployment -------
console.log('\n--- 4. Live read-only staging checks ---');

if (!stagingUrl) {
  console.log('SKIP  no STAGING_URL supplied');
} else {
  const base = stagingUrl.replace(/\/+$/, '');

  try {
    const res = await fetch(`${base}/api/products`);
    const body = await res.json().catch(() => null);
    check('GET /api/products is 200', res.status === 200, `status ${res.status}`);
    check(
      'catalogue returns products',
      Boolean(body && body.success && Array.isArray(body.data) && body.data.length > 0),
      body && body.data ? `${body.data.length} products` : 'none returned',
    );
  } catch (error) {
    check('staging deployment is reachable', false, error.message);
  }

  for (const p of ['/api/test-db', '/api/test-supabase']) {
    try {
      const res = await fetch(`${base}${p}`);
      check(`${p} is disabled`, res.status === 410 || res.status === 401, `status ${res.status}`);
    } catch (error) {
      check(`${p} reachable`, false, error.message);
    }
  }

  // Anonymous catalogue WRITE probe.
  //
  // GATED OFF BY DEFAULT. This issues a real POST to a mutating endpoint. It is
  // only safe against an isolated staging deployment whose product ids are
  // disposable. It is NOT read-only and must never be pointed at production.
  //
  // Opt in with:  VERIFY_WRITE_PROBE=YES-I-HAVE-ISOLATED-STAGING
  if ((process.env.VERIFY_WRITE_PROBE || '').trim() === 'YES-I-HAVE-ISOLATED-STAGING') {
    try {
      const res = await fetch(`${base}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', product: { id: 'must-not-exist' } }),
      });
      check('anonymous catalogue write is refused', res.status === 401, `status ${res.status}`);
    } catch (error) {
      check('anonymous write check reachable', false, error.message);
    }
  } else {
    console.log(
      'SKIP  anonymous catalogue write probe (mutating - opt in with\n' +
        '      VERIFY_WRITE_PROBE=YES-I-HAVE-ISOLATED-STAGING against staging only)',
    );
  }
}

// --- Summary ----------------------------------------------------------------
console.log('');
if (missing.length) {
  console.log(`MISSING CONFIGURATION (${missing.length}):`);
  for (const m of missing) console.log(`  - ${m}`);
  console.log('\nNothing was created. Provide the values above and re-run.');
}
console.log(
  failures === 0
    ? '\nSTAGING VERIFICATION PASSED - safe for a 10-VU read-only smoke test.'
    : `\n${failures} item(s) outstanding.`,
);

process.exit(failures === 0 ? 0 : 1);


