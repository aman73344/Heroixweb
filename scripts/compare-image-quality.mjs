// Encodes catalogue pictures at several WebP quality settings and reports the byte
// cost of each, so the number in generate-image-derivatives.mjs is a measured
// choice rather than a guess. Also writes sample files to <tmp>/heroix-quality, so
// the result can be looked at and not only measured.
//
// With no arguments it samples the WHOLE catalogue, because a decision to change
// the shipped quality should rest on every picture rather than one flattering one.
//
// Run:  node scripts/compare-image-quality.mjs
//       QUALITY_LIMIT=4 node scripts/compare-image-quality.mjs   (quick look)

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { register } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

register('./ts-resolve-hooks.mjs', import.meta.url);

// Re-exec with the TS flag on Node builds that cannot import a .ts file directly -
// the same trick generate-image-derivatives.mjs uses.
if (!(await canImportTypeScript())) {
  if (process.env.HEROIX_TS_STRIP === '1') {
    console.error('This Node build cannot import TypeScript directly. Node 22.6+ required.');
    process.exit(1);
  }
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit', env: { ...process.env, HEROIX_TS_STRIP: '1' } },
  );
  process.exit(result.status ?? 1);
}

async function canImportTypeScript() {
  try {
    await import('../lib/variants.ts');
    return true;
  } catch (error) {
    if (error?.code === 'ERR_UNKNOWN_FILE_EXTENSION') return false;
    throw error;
  }
}

const { parseVariants, getVariantImages } = await import('../lib/variants.ts');

const WIDTH = 800;
const levels = [78, 70, 65];
const LIMIT = Number(process.env.QUALITY_LIMIT || 24);
const CONCURRENCY = 6;

const outDir = join(tmpdir(), 'heroix-quality');
mkdirSync(outDir, { recursive: true });

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

const { data: rows, error } = await supabase.from('products').select('*');
if (error) {
  console.error('QUERY ERROR:', error.message);
  process.exit(1);
}

const urls = new Set();
for (const row of rows) {
  if (row.image) urls.add(row.image);
  for (const u of row.image_urls || []) urls.add(u);
  for (const v of parseVariants(row.variants)) {
    for (const u of getVariantImages(v)) urls.add(u);
  }
}
const originals = [...urls].filter((u) => typeof u === 'string' && u.includes('/storage/'));
// Spread across the catalogue rather than the first N, which would all be one
// product and give a very lopsided answer.
const step = Math.max(1, Math.floor(originals.length / LIMIT));
const sample = originals.filter((_, i) => i % step === 0).slice(0, LIMIT);

const human = (b) => `${(b / 1024).toFixed(1)} KB`;
const totals = new Map(levels.map((q) => [q, 0]));
const worst = new Map(levels.map((q) => [q, { bytes: 0, name: '' }]));
let originalTotal = 0;
let failures = 0;
let cursor = 0;

async function measure(url) {
  const name = url.split('/').pop();
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    originalTotal += source.length;

    // Exactly the generator's pipeline, with only `quality` varying.
    const resized = await sharp(source)
      .rotate()
      .resize({ width: WIDTH, withoutEnlargement: true })
      .toBuffer();

    for (const quality of levels) {
      const out = await sharp(resized).webp({ quality, effort: 4 }).toBuffer();
      totals.set(quality, totals.get(quality) + out.length);
      if (out.length > worst.get(quality).bytes) worst.set(quality, { bytes: out.length, name });
      // Keep one picture per setting so the result can be eyeballed, not just totalled.
      if (quality === levels[0]) writeFileSync(join(outDir, `sample-q${quality}.webp`), out);
    }
  } catch (err) {
    failures += 1;
    console.error(`  ${name}: ${err.message}`);
  }
}

await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, sample.length) }, async () => {
    while (cursor < sample.length) {
      await measure(sample[cursor++]);
      process.stdout.write(`\r  ${cursor}/${sample.length} encoded   `);
    }
  }),
);
process.stdout.write('\n');

const measured = Math.max(1, sample.length - failures);
console.log(`\n  ${measured} picture(s) at ${WIDTH}px`);
console.log(`    originals    ${human(originalTotal).padStart(10)}`);
const q0 = totals.get(levels[0]);
for (const quality of levels) {
  const size = totals.get(quality);
  const vsOriginal = ((size / originalTotal) * 100).toFixed(0);
  const delta = quality === levels[0] ? '' : `${(((q0 - size) / q0) * 100).toFixed(0)}% smaller`;
  console.log(
    `    q${String(quality).padEnd(3)}       ${human(size).padStart(10)}    ${String(vsOriginal).padStart(3)}% of original   ${delta}`,
  );
}

console.log('\n  heaviest single picture per setting (the worst case)');
for (const quality of levels) {
  const w = worst.get(quality);
  console.log(`    q${String(quality).padEnd(3)}       ${human(w.bytes).padStart(10)}    ${w.name}`);
}

console.log('\n  average cost of ONE 800px gallery image');
for (const quality of levels) {
  console.log(`    q${String(quality).padEnd(3)}       ~${human(totals.get(quality) / measured)}`);
}
console.log(`\n  samples in ${outDir}\n`);

process.exit(failures > 0 ? 1 : 0);

console.log(`\n  catalogue: ${rows.length} products, ${originals.length} storage pictures`);
console.log(`  encoding ${sample.length} of them at ${WIDTH}px, qualities ${levels.join(', ')}`);
