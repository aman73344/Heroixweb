// Targeted mirror: copies ONLY `_thumbs/` derivative objects from Supabase to
// Cloudflare R2. The full mirror-images-r2.mjs lists all ~1300 bucket objects
// first, which times out in this terminal; listing one prefix is far quicker.
//
// WHY THIS EXISTS: NEXT_PUBLIC_IMAGES_CDN_BASE points the frontend at R2, so
// <SmartImage> asks R2 for every derivative. Any derivative that only exists in
// Supabase 404s on R2, the browser falls back to the 785 KB original, and the
// page loads late again.

import { readFileSync } from 'node:fs';
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';

// `--verify` mode: HEAD a handful of mirrored derivatives on the public CDN
// (NEXT_PUBLIC_IMAGES_CDN_BASE) to prove the frontend will stop falling back
// to Supabase. Usage: node scripts/mirror-thumbs-r2.mjs --verify=10
const VERIFY_ARG = process.argv.find((a) => a.startsWith('--verify'));
const VERIFY = VERIFY_ARG ? Number(VERIFY_ARG.split('=')[1]) || 10 : 0;

// Minimal .env parser - no regex, so no escaping pitfalls.
for (const file of ['.env.local', '.env']) {
  try {
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i <= 0) continue;
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      const key = line.slice(0, i).trim();
      if (v && !process.env[key]) process.env[key] = v;
    }
  } catch { /* optional file */ }
}

function stripTrailing(s, ch) {
  while (s.endsWith(ch)) s = s.slice(0, -1);
  return s;
}

let stdoutUnavailable = false;
process.stdout.on('error', (error) => {
  if (error?.code === 'EPIPE') {
    stdoutUnavailable = true;
    return;
  }
  throw error;
});

function log(msg) {
  const line = `${msg}`;
  if (stdoutUnavailable) {
    console.error(line);
    return;
  }

  try {
    console.log(line);
  } catch (error) {
    if (error?.code !== 'EPIPE') throw error;
    stdoutUnavailable = true;
    console.error(line);
  }
}

const SUPABASE_URL = stripTrailing(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '', '/');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const R2_ENDPOINT = process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || 'products';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.log('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.log('Missing R2 credentials');
  process.exit(1);
}

const r2 = new S3Client({
  endpoint: R2_ENDPOINT,
  region: 'auto',
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  forcePathStyle: true,
});

// List every object under the `_thumbs/` prefix in Supabase Storage.
// Layout is `_thumbs/<prod-id>/<file>@<width>.webp`, so the listing descends
// one folder level at a time exactly like scripts/mirror-images-r2.mjs does
// for the whole bucket - calling list with a deep prefix and no descent is
// how earlier runs "found 0 derivative objects".
async function listSupabaseThumbs() {
  const objects = [];
  const queue = ['_thumbs/'];
  let folders = 0;
  while (queue.length) {
    const prefix = queue.shift();
    folders += 1;
    if (folders % 25 === 0) log(`  ...walked ${folders} folders, ${objects.length} objects so far`);
    let offset = 0;
    const limit = 1000;
    for (;;) {
      const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/list/products`, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix, limit, offset, sortBy: { column: 'name', order: 'asc' } }),
      });
      if (!resp.ok) throw new Error(`Supabase list ${prefix}: ${resp.status} ${await resp.text()}`);
      const page = await resp.json();
      const entries = Array.isArray(page) ? page : [];
      for (const e of entries) {
        const key = `${prefix}${e.name}`;
        // Folder markers have no metadata; real objects carry size inside it.
        if (!e.metadata) {
          queue.push(`${key}/`);
          continue;
        }
        objects.push({ name: key, size: e.metadata.size || 0 });
      }
      if (entries.length < limit) break;
      offset += limit;
    }
  }
  return objects;
}

// Every _thumbs/ key already on R2 -> its size, for cheap skip-by-size checks.
async function listR2Thumbs() {
  const existing = new Map();
  let token;
  do {
    const result = await r2.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: '_thumbs/',
      ContinuationToken: token,
    }));
    for (const obj of result.Contents || []) existing.set(obj.Key, obj.Size);
    token = result.NextContinuationToken;
  } while (token);
  return existing;
}

async function copyOne(key) {
  const encoded = key.split('/').map(encodeURIComponent).join('/');
  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/public/products/${encoded}`, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!resp.ok) throw new Error(`Supabase GET ${resp.status} ${resp.statusText}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buf,
    ContentType: 'image/webp',
    CacheControl: '31536000',
  }));
  return buf.length;
}

async function main() {
  if (VERIFY) {
    // CDN base from the env exactly as the frontend reads it.
    const base = (process.env.NEXT_PUBLIC_IMAGES_CDN_BASE || '').replace(/\/+$/, '');
    if (!base) {
      log('Missing NEXT_PUBLIC_IMAGES_CDN_BASE - nothing to verify against.');
      process.exitCode = 1;
      return;
    }
    log(`Verifying ${VERIFY} derivative URLs on ${base} ...`);
    const existing = await listR2Thumbs();
    const keys = [...existing.keys()].filter((k) => k.endsWith('.webp')).slice(0, VERIFY);
    let okCount = 0;
    for (const key of keys) {
      const resp = await fetch(`${base}/${key}`, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
      const len = resp.headers.get('content-length') || '?';
      const expected = existing.get(key);
      const good = resp.status === 200 && Number(len) === expected;
      if (good) okCount += 1;
      log(`  ${good ? 'OK  ' : 'BAD '} ${resp.status} len=${len}/${expected} ${key}`);
    }
    log(`Verify done: ${okCount}/${keys.length} derivatives served from the CDN.`);
    process.exitCode = okCount === keys.length ? 0 : 1;
    return;
  }

  log('Listing _thumbs/ in Supabase...');
  const source = await listSupabaseThumbs();
  log(`  found ${source.length} derivative objects in Supabase`);

  const existing = await listR2Thumbs();
  log(`  found ${existing.size} derivative objects already on R2`);

  const targets = source.filter((o) => existing.get(o.name) !== o.size && o.name.endsWith('.webp'));
  log(`  to copy: ${targets.length}`);

  let copied = 0;
  let failed = 0;
  let copiedBytes = 0;
  for (const obj of targets) {
    try {
      const bytes = await copyOne(obj.name);
      copied += 1;
      copiedBytes += bytes;
      if (copied % 10 === 0 || copied === targets.length) {
        log(`  ${copied}/${targets.length} copied (${(copiedBytes / 1024 / 1024).toFixed(2)} MB)`);
      }
    } catch (e) {
      failed += 1;
      log(`  FAILED ${obj.name}: ${e.message}`);
    }
  }

  log(`Done: ${copied} copied, ${failed} failed, ${(copiedBytes / 1024 / 1024).toFixed(2)} MB`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((e) => { log(String((e && e.stack) || e)); process.exitCode = 1; });