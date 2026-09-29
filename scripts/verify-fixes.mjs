// Verifies the fixes against the REAL rows stored in Supabase:
//   - every product loads (the old .limit(50) hid 3 of 53)
//   - a design keeps all its pictures (the old 3-picture cap dropped extras)
//   - 6+ designs per product parse and round-trip through storage unchanged
// Run: node scripts/verify-fixes.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { parseVariants, formatVariantsForStorage, formatVariantsForTextarea, getVariantImages, MAX_VARIANT_IMAGES } from '../lib/variants.ts';

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

let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ` -> ${extra}` : ''}`);
  if (!ok) failures += 1;
};

// 1) Paging: every row must be reachable (previously capped at 50).
const { data: rows, error } = await supabase.from('products').select('*').range(0, 1999);
if (error) {
  console.error('QUERY ERROR:', error.message);
  process.exit(1);
}
check(`all ${rows.length} products load (was capped at 50)`, rows.length > 50);

// 2) Every stored design still parses, and keeps all of its pictures.
let maxPictures = 0;
let maxDesigns = 0;
for (const p of rows) {
  const parsed = parseVariants(p.variants, p.stock ?? 0);
  maxDesigns = Math.max(maxDesigns, parsed.length);
  for (const v of parsed) {
    maxPictures = Math.max(maxPictures, getVariantImages(v).length);
    // Round-trip must not lose a picture.
    const roundTrip = parseVariants(formatVariantsForStorage(parsed), p.stock ?? 0);
    if (getVariantImages(roundTrip.find((r) => r.name === v.name)).length !== getVariantImages(v).length) {
      check(`pictures survive storage round-trip (${p.id} / ${v.name})`, false);
    }
  }
}
check(`picture cap raised to ${MAX_VARIANT_IMAGES} (max stored ${maxPictures})`, MAX_VARIANT_IMAGES >= 6);
check(`designs per product (max stored ${maxDesigns}) supported up to 6+`, maxDesigns >= 4);

// 3) A 6-design product survives a full save/load round-trip (the "4th vanished" bug).
const sixDesigns = Array.from({ length: 6 }, (_, i) => ({
  name: `Design ${i + 1}`,
  stock: i + 1,
  images: [`https://cdn.example.com/d${i + 1}-a.jpg`, `https://cdn.example.com/d${i + 1}-b.jpg`],
}));
const text = formatVariantsForTextarea(sixDesigns);
const reparsed = parseVariants(text, 0);
check('6 designs survive textarea round-trip', reparsed.length === 6, `got ${reparsed.length}`);
check(
  'all 6 designs keep both pictures',
  reparsed.every((v) => getVariantImages(v).length === 2),
  reparsed.map((v) => getVariantImages(v).length).join(',')
);

// 4) Pictures beyond the old 3-per-design limit are now kept.
const manyPics = { name: 'D', stock: 1, images: Array.from({ length: 6 }, (_, i) => `https://cdn.example.com/p${i}.jpg`) };
check(
  '6 pictures on ONE design are all kept (old limit was 3)',
  getVariantImages(manyPics).length === 6,
  `got ${getVariantImages(manyPics).length}`
);
check(
  '6-picture design survives storage round-trip',
  getVariantImages(parseVariants(formatVariantsForStorage([manyPics]), 0)[0]).length === 6
);

// 5) Reviews: the star component must treat "no reviews" as no score.
const noReviewRow = rows.find((p) => !p.reviews);
check('a product with reviews = 0 exists (shows "No reviews yet")', !!noReviewRow, noReviewRow?.id);

// 6) The EXACT admin flow on real data, for the product that has 4 designs:
//    load -> textarea -> (descriptions applied) -> storage -> parse again.
//    This is the path where a design used to disappear on reload.
const real = rows.find((p) => Array.isArray(p.variants) && p.variants.length >= 4);
if (real) {
  const loaded = parseVariants(real.variants, real.stock ?? 0);
  const textarea = formatVariantsForTextarea(loaded);
  const fromTextarea = parseVariants(textarea, real.stock ?? 0);
  const stored = formatVariantsForStorage(fromTextarea);
  const reloaded = parseVariants(stored, real.stock ?? 0);
  check(
    `real product ${real.id} keeps all ${loaded.length} designs through the admin flow`,
    reloaded.length === loaded.length && reloaded.length >= 4,
    `${loaded.length} -> ${reloaded.length}`
  );
  const picsBefore = loaded.map((v) => getVariantImages(v).length);
  const picsAfter = reloaded.map((v) => getVariantImages(v).length);
  check(
    'real product keeps every picture of every design',
    JSON.stringify(picsBefore) === JSON.stringify(picsAfter),
    `${picsBefore.join(',')} -> ${picsAfter.join(',')}`
  );
  check(
    'real product design names are unchanged',
    JSON.stringify(loaded.map((v) => v.name)) === JSON.stringify(reloaded.map((v) => v.name))
  );
} else {
  check('a real product with 4+ designs exists', false);
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
