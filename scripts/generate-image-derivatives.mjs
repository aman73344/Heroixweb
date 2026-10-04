// Generates the WebP derivatives the storefront downloads instead of the
// full-size originals.
//
// WHY A SCRIPT AND NOT A RUNTIME TRANSFORM
// Supabase's own image transformations (`/storage/v1/render/image/public/...`)
// were tried against this project and answered HTTP 403 with "Image
// Transformations are not allowed" - they are a paid feature, and this project
// is on the free plan. There is no second image service in the project either.
// So the only way to stop shipping a 785 KB original into a 384px slot is to
// produce the smaller files once and let the browser pick one per slot.
//
// WHAT IT DOES
// 1. Reads the catalogue (product `image`, `image_urls`, and every design
//    picture inside `variants`).
// 2. Downloads each DISTINCT original once.
// 3. Re-encodes it to WebP at every width in lib/image-url.ts IMAGE_WIDTHS,
//    never upscaling.
// 4. Uploads the result next to the original under the `_thumbs/` prefix in the
//    SAME public bucket, with a one-year immutable cache header so the CDN and
//    the browser stop asking for the same thumbnail twice.
//
// Nothing is deleted and no original is modified, so stopping the optimisation
// is a matter of ignoring (or deleting) the `_thumbs/` folder.
//
// SAFE TO RE-RUN
// Skips a picture whose derivatives already exist, `--force` re-uploads,
// `--dry-run` reports the plan and the projected saving without writing.
//
// Run:  npm run images:optimize -- --dry-run

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The same hook verify-fixes.mjs uses, so this script imports the app's REAL
// lib/image-url.ts. Repeating the `_thumbs/<path>@<w>.webp` rule here instead is
// exactly how a generator and a UI end up disagreeing about which file exists,
// and the symptom is broken images that only show up in production.
register('./ts-resolve-hooks.mjs', import.meta.url);

// Node only learned to import a .ts file by itself in 22.18; on anything older
// it has to be told to strip the types. Re-running itself once with that flag
// beats making every caller (the npm script, CI, a teammate's terminal) have to
// remember it - and beats copying the app's rules into a second implementation.
if (!(await canImportTypeScript())) {
  if (process.env.HEROIX_TS_STRIP === '1') {
    console.error(
      'This Node build cannot import TypeScript directly. Node 22.6 or newer is required.',
    );
    process.exit(1);
  }
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      fileURLToPath(import.meta.url),
      ...process.argv.slice(2),
    ],
    { stdio: 'inherit', env: { ...process.env, HEROIX_TS_STRIP: '1' } },
  );
  process.exit(result.status ?? 1);
}

async function canImportTypeScript() {
  try {
    await import('../lib/image-url.ts');
    return true;
  } catch (error) {
    if (error?.code === 'ERR_UNKNOWN_FILE_EXTENSION') return false;
    throw error;
  }
}

const { IMAGE_WIDTHS, derivativePath, parseStorageObject } = await import('../lib/image-url.ts');
const { parseVariants, getVariantImages } = await import('../lib/variants.ts');

// The WebP quality used for the generated derivatives.
//
// MEASURED, NOT GUESSED. `node scripts/compare-image-quality.mjs` re-encoded a
// spread sample of the catalogue at 800px and reported:
//
//   q78   2737.7 KB   22% of the originals   <- what this shipped as
//   q70   2330.3 KB   19% of the originals   15% smaller, ~18 KB per image
//   q65   2202.9 KB   18% of the originals   20% smaller, ~23 KB per image
//
// At 3x magnification (`scripts/zoom-image-quality.mjs`) the q70 engraving on the
// blade and chain is indistinguishable from q78, while q65 visibly softens the
// fine texture. q70 is therefore the honest setting: most of the saving, none of
// the visible loss. Dropping to q65 would trade real detail for a further 5% that
// nobody would notice but everybody pays for.
//
// This only affects the 800px gallery tier; the 400px thumbnails are small enough
// that quality is not what costs them bytes.
const WEBP_QUALITY = 70;

const BUCKET = 'products';
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const FORCE = args.has('--force');
const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1]) || 0;
const CONCURRENCY = 4;

// Supabase serves the originals with `cache-control: public, max-age=3600`. The
// derivatives are content-addressed by width and never change, so they get a
// year - that is what stops a returning visitor from re-downloading thumbnails.
const CACHE_CONTROL = '31536000';

// --- config -----------------------------------------------------------------

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

const projectUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!projectUrl || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY. Cannot read the catalogue.');
  process.exit(1);
}
const supabase = createClient(projectUrl, key);

// `object.path` is the bucket-qualified key as it appears in a public url, so
// it is appended as-is. Prefixing the bucket again is what produces a 400 from
// Storage.
const publicUrl = (object) => `${projectUrl}/storage/v1/object/public/${object.path}`;
const human = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Every distinct picture url the storefront can possibly ask for. */
async function collectImageUrls() {
  const found = new Set();
  const { data, error } = await supabase.from('products').select('id, image, image_urls, variants');
  if (error) throw error;

  const add = (value) => {
    if (typeof value === 'string' && value.trim()) found.add(value.trim());
  };

  for (const row of data || []) {
    add(row.image);
    if (Array.isArray(row.image_urls)) row.image_urls.forEach(add);
    // Designs live in the `variants` column and carry their own pictures - these
    // are exactly the ones a listing page used to download in full, for every
    // product on the page, without anyone opening it.
    for (const variant of parseVariants(row.variants, 0)) {
      getVariantImages(variant).forEach(add);
    }
  }
  return [...found];
}

// --- run --------------------------------------------------------------------

const urls = await collectImageUrls();
const objects = urls.map((u) => parseStorageObject(u)).filter((o) => o !== null);
const skippedUrls = urls.length - objects.length;
const targets = objects.slice(0, LIMIT || undefined);

console.log(`\nHeroix image derivatives`);
console.log(`  bucket             ${BUCKET}`);
console.log(`  widths             ${IMAGE_WIDTHS.join(', ')} px (WebP q78)`);
console.log(`  picture urls       ${urls.length} (${objects.length} in Storage, ${skippedUrls} elsewhere)`);
console.log(`  mode               ${DRY_RUN ? 'DRY RUN - nothing will be written' : FORCE ? 'FORCE - re-uploading everything' : 'incremental'}\n`);

const report = {
  processed: 0,
  uploaded: 0,
  skipped: 0,
  failed: 0,
  originalBytes: 0,
  derivativeBytes: 0,
  errors: [],
};

/** True when this picture's derivatives are already in the bucket. */
async function alreadyGenerated(object) {
  if (FORCE) return false;
  // One cheap public HEAD instead of downloading and re-encoding 785 KB.
  const response = await fetch(
    `${projectUrl}/storage/v1/object/public/${object.bucket}/${derivativePath(object.key, IMAGE_WIDTHS[0])}`,
    { method: 'HEAD' },
  );
  return response.ok;
}

async function processOne(object) {
  try {
    if (await alreadyGenerated(object)) {
      report.skipped += 1;
      return;
    }

    const response = await fetch(publicUrl(object));
    if (!response.ok) throw new Error(`download failed: HTTP ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    report.originalBytes += source.length;

    for (const width of IMAGE_WIDTHS) {
      // withoutEnlargement: a 600px original must not become a blurry 800px.
      const buffer = await sharp(source)
        .rotate() // honour the EXIF orientation before resizing
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer();
      report.derivativeBytes += buffer.length;

      if (!DRY_RUN) {
        const { error: uploadError } = await supabase.storage
          .from(object.bucket)
          .upload(derivativePath(object.key, width), buffer, {
            contentType: 'image/webp',
            cacheControl: CACHE_CONTROL,
            upsert: true,
          });
        if (uploadError) throw uploadError;
      }
      report.uploaded += 1;
    }

    report.processed += 1;
    if (report.processed % 20 === 0 || report.processed === targets.length) {
      console.log(
        `  ${String(report.processed).padStart(4)}/${targets.length}  ` +
          `originals ${human(report.originalBytes)} -> derivatives ${human(report.derivativeBytes)}`,
      );
    }
  } catch (error) {
    report.failed += 1;
    report.errors.push(`${object.path}: ${error.message}`);
  }
}

// A small worker pool: enough requests in flight to be quick, few enough that a
// burst never trips a rate limit.
let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
    while (cursor < targets.length) {
      const index = cursor++;
      await processOne(targets[index]);
    }
  }),
);

const ratio = report.originalBytes > 0 ? report.derivativeBytes / report.originalBytes : 0;
const ratioLabel = ratio ? ` (${(ratio * 100).toFixed(0)}% of the original size)` : '';

console.log(`\n  pictures processed    ${report.processed}`);
console.log(`  derivatives written   ${report.uploaded}`);
console.log(`  pictures skipped      ${report.skipped} (already generated)`);
console.log(`  failures              ${report.failed}`);
console.log(
  `  one full pass over these pictures: ${human(report.originalBytes)} of originals -> ` +
    `${human(report.derivativeBytes)} of derivatives${ratioLabel}`,
);
if (report.errors.length) {
  console.log('\n  first failures:');
  report.errors.slice(0, 5).forEach((e) => console.log(`    - ${e}`));
}
if (DRY_RUN) console.log('\n  Re-run without --dry-run to write these files.\n');
else console.log('\n  Done. The storefront picks them up on the next page load.\n');

process.exit(report.failed > 0 ? 1 : 0);
