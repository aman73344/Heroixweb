// Mirrors the whole `products` bucket from Supabase Storage to Cloudflare R2,
// object-for-object with IDENTICAL keys, so the app can serve the same
// `_thumbs/...@<width>.webp` paths from R2 (zero egress) instead of Supabase
// (5 GB/month egress quota).
//
// WHY R2: image delivery is ~85% of this site's Supabase egress. R2's free
// tier is 10 GB storage + 10M reads + 1M writes per month with NO egress
// charges at all - this catalogue (~200 MB, ~1,200 objects) fits with a 40x
// margin, so ad traffic stops being a quota question entirely.
//
// SAFE TO RE-RUN (idempotent): every object is compared against R2 by size
// and skipped when it is already there, so a partial run just finishes the
// remainder next time. Nothing is deleted on either side, ever.
//
// ENV (all read from .env.local / .env like the other scripts):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY        (existing - the SOURCE)
//   R2_ENDPOINT     e.g. https://<accountid>.r2.cloudflarestorage.com
//                   (or set R2_ACCOUNT_ID and the endpoint is derived)
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY    (from an R2 API token with
//                                              Object Read & Write)
//   R2_BUCKET       defaults to `products` (the bucket NAME on the R2 side)
//
// RUN:
//   node scripts/mirror-images-r2.mjs            sync
//   node scripts/mirror-images-r2.mjs --dry-run  inventory only, no R2 needed
//   node scripts/mirror-images-r2.mjs --limit=20 first 20 objects, for testing
//
// The public URL used after go-live is NEXT_PUBLIC_IMAGES_CDN_BASE
// (lib/image-url.ts maps derivative URLs to it), NOT anything in this file.

import { readFileSync } from 'node:fs';
import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1]) || 0;

/** Bytes as a short human string, e.g. `45.8 MB`. */
function human(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// --- env ---------------------------------------------------------------------

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (value && !process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    /* optional file */
  }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : '');
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || 'products';
const SOURCE_BUCKET = 'products';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY - cannot read the source bucket.');
  process.exit(1);
}
const r2Ready = Boolean(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
if (!DRY_RUN && !r2Ready) {
  console.error(
    'Missing R2 configuration. Need R2_ENDPOINT (or R2_ACCOUNT_ID), R2_ACCESS_KEY_ID and\n' +
      'R2_SECRET_ACCESS_KEY in .env.local - or run with --dry-run to just list the inventory.',
  );
  process.exit(1);
}

const r2 = r2Ready
  ? new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
  : null;

// --- source: walk Supabase Storage -------------------------------------------

/** Every object in the source bucket: key, size, contentType, cacheControl. */
async function listSupabase() {
  const objects = [];
  const queue = [''];
  while (queue.length) {
    const prefix = queue.shift();
    const response = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${SOURCE_BUCKET}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!response.ok) throw new Error(`list ${prefix || '/'}: HTTP ${response.status} ${await response.text()}`);
    for (const item of await response.json()) {
      const key = `${prefix}${item.name}`;
      if (!item.metadata) {
        queue.push(`${key}/`);
        continue;
      }
      objects.push({
        key,
        size: item.metadata.size || 0,
        contentType: item.metadata.mimetype || 'application/octet-stream',
        // Derivatives were uploaded with a 1-year immutable cache; keep
        // whatever the source says so R2 honours the same freshness.
        cacheControl: item.metadata.cacheControl || (key.includes('/_thumbs/') ? '31536000' : '3600'),
      });
    }
  }
  return objects;
}

/** Which keys R2 already has, and at what size. */
async function listR2() {
  const existing = new Map();
  let token;
  do {
    const page = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: token }));
    for (const item of page.Contents || []) existing.set(item.Key, item.Size);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return existing;
}

// --- copy --------------------------------------------------------------------

async function copyOne(object) {
  const encoded = object.key.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${SOURCE_BUCKET}/${encoded}`);
  if (!response.ok) throw new Error(`download: HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: object.key,
      Body: body,
      ContentType: object.contentType,
      CacheControl: object.cacheControl,
    }),
  );
  return body.length;
}

// --- run ---------------------------------------------------------------------

console.log(`\nHeroix image mirror: Supabase -> R2`);
console.log(`  source             ${SUPABASE_URL} / ${SOURCE_BUCKET}`);
console.log(`  destination        ${R2_BUCKET}${R2_ENDPOINT ? ` @ ${R2_ENDPOINT}` : ' (not configured)'}`);
console.log(`  mode               ${DRY_RUN ? 'DRY RUN - nothing will be written' : 'sync (idempotent)'}\n`);

const source = await listSupabase();
const sourceBytes = source.reduce((sum, o) => sum + o.size, 0);
console.log(`  source objects     ${source.length} (${human(sourceBytes)})`);

const report = { copied: 0, skipped: 0, failed: 0, copiedBytes: 0, errors: [] };

if (DRY_RUN) {
  if (r2) {
    const existing = await listR2();
    for (const object of source) {
      if (existing.get(object.key) === object.size) report.skipped += 1;
      else report.copied += 1; // would copy
    }
    console.log(`  already on R2      ${report.skipped}`);
    console.log(`  would copy         ${report.copied}`);
  } else {
    console.log('  (no R2 credentials yet - showing the Supabase side only)');
    console.log(`  would copy         ${source.length} objects once R2 is configured`);
  }
  console.log('\n  Dry run only. Run without --dry-run to copy.\n');
  process.exit(0);
}

const existing = await listR2();
console.log(`  already on R2      ${existing.size} objects\n`);

const targets = source.filter((object) => existing.get(object.key) !== object.size);
if (LIMIT) targets.length = Math.min(targets.length, LIMIT);
console.log(`  to copy            ${targets.length} objects\n`);

let cursor = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (cursor < targets.length) {
      const object = targets[cursor++];
      try {
        report.copiedBytes += await copyOne(object);
        report.copied += 1;
      } catch (error) {
        report.failed += 1;
        if (report.errors.length < 5) report.errors.push(`${object.key}: ${error.message}`);
      }
      if ((report.copied + report.failed) % 50 === 0 || report.copied + report.failed === targets.length) {
        console.log(`  ${report.copied + report.failed}/${targets.length}  copied ${human(report.copiedBytes)}`);
      }
    }
  }),
);

console.log(`\n  copied             ${report.copied} (${human(report.copiedBytes)})`);
console.log(`  already present    ${report.skipped}`);
console.log(`  failures           ${report.failed}`);
if (report.errors.length) {
  console.log('\n  first failures:');
  report.errors.forEach((e) => console.log(`    - ${e}`));
}
console.log(
  report.failed === 0
    ? '\n  Done. Mirror is complete - set NEXT_PUBLIC_IMAGES_CDN_BASE to go live.\n'
    : '\n  Finished WITH FAILURES - re-run to retry just the missing objects.\n',
);
process.exit(report.failed > 0 ? 1 : 0);
