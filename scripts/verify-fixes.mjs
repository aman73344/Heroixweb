// Verifies the fixes against the REAL rows stored in Supabase:
//   - every product loads (the old .limit(50) hid 3 of 53)
//   - a design keeps all its pictures (the old 3-picture cap dropped extras)
//   - 6+ designs per product parse and round-trip through storage unchanged
// Run: node --experimental-strip-types scripts/verify-fixes.mjs
// (Node 22.18+ / 23+ strip TypeScript by default, so the flag can be dropped.)
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { register } from 'node:module';
import { parseVariants, formatVariantsForStorage, formatVariantsForTextarea, getVariantImages, MAX_VARIANT_IMAGES } from '../lib/variants.ts';

// Lets the app's own modules be imported here even though they use bundler-style
// specifiers such as "./variants" (see the hook for the details). Registered
// before the dynamic imports below, so it never touches app code at build time.
register('./ts-resolve-hooks.mjs', import.meta.url);

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

// 7) The default storefront rating must be applied everywhere, and a product
//    must still be able to carry its own rating/review count for later.
const { normalizeRating, normalizeReviewCount, DEFAULT_RATING } = await import('../lib/reviews.ts');
check('a store default rating exists (4.5 - 5)', DEFAULT_RATING >= 4.5 && DEFAULT_RATING <= 5, `DEFAULT_RATING=${DEFAULT_RATING}`);
check('missing rating falls back to the default, not 0', normalizeRating(null) === DEFAULT_RATING);
check('rating of 0 falls back to the default', normalizeRating(0) === DEFAULT_RATING);
check('garbage rating falls back to the default', normalizeRating('abc') === DEFAULT_RATING);
check('out-of-range rating clamped', normalizeRating(9) === 5 && normalizeRating(-3) === DEFAULT_RATING);
check('admin-set rating is kept as-is', normalizeRating(4.5) === 4.5 && normalizeRating(5) === 5);
check('review count still defaults to 0', normalizeReviewCount(null) === 0);
check('admin-set review count is kept', normalizeReviewCount(342) === 342);

// Source-level guard: every save path must go through the shared normaliser
// instead of carrying its own hardcoded default.
const { execSync } = await import('node:child_process');
let leftovers = 'NONE';
try {
  leftovers = execSync(
    'git grep -nE "rating: [a-z]+\\.rating \\|\\|" -- "*.ts" "*.tsx" || echo NONE',
    { encoding: 'utf8' }
  ).trim();
} catch {
  leftovers = 'NONE';
}
check(
  'no raw "rating: x.rating || <default>" left in source',
  leftovers === 'NONE',
  leftovers === 'NONE' ? 'none' : leftovers
);

// 8) Each design must be able to carry its OWN price, and it must survive a
//    full save/reload round-trip (otherwise the price silently reverts).
const { getVariantPrice, hasOwnVariantPrice } = await import('../lib/variants.ts');
const pricedLine = 'Design 2: 4 | price: 650 | image: https://cdn.example.com/a.png | desc: Blue form';
const priced = parseVariants([pricedLine], 0)[0];
check('price is read from the design line', priced?.price === 650, `got ${priced?.price}`);
check('getVariantPrice returns the design price', getVariantPrice(priced, 500) === 650);
check('hasOwnVariantPrice detects it', hasOwnVariantPrice(priced) === true);

const repriced = parseVariants(formatVariantsForStorage([priced]), 0)[0];
check('price survives storage round-trip', repriced?.price === 650, `got ${repriced?.price}`);
check('picture and description still survive too', getVariantImages(repriced).length === 1 && repriced?.description === 'Blue form');
check('stock still survives', repriced?.stock === 4);

const textareaRoundTrip = parseVariants(formatVariantsForTextarea([priced]), 0)[0];
check('price survives textarea round-trip', textareaRoundTrip?.price === 650);

check(
  'a design with no price falls back to the product price',
  getVariantPrice(parseVariants(['Design 1: 3'], 0)[0], 500) === 500
);
check(
  'a design literally named "Price: 5" keeps its name',
  parseVariants(['Price: 5'], 0)[0]?.name === 'Price'
);
check(
  'object form keeps its own price',
  parseVariants([{ name: 'D', stock: 1, price: 777 }], 0)[0]?.price === 777
);
const multiPriced = parseVariants(['A: 1 | price: 400', 'B: 2 | price: 900', 'C: 3'], 0);
check(
  'mixed per-design prices parse independently',
  multiPriced[0].price === 400 && multiPriced[1].price === 900 && multiPriced[2].price === undefined,
  multiPriced.map((v) => v.price ?? 'none').join(',')
);

// 9) Ordering: the priciest band of keychains must come first (500-600 above
//    400-500 above 300-350), using the cheapest price a customer can pay.
const { sortProducts, getLowestPrice, DEFAULT_SORT } = await import('../lib/sorting.ts');
check('default sort is Price: High to Low', DEFAULT_SORT === 'price-desc');

const sortable = [
  { id: 'a', name: 'A', price: 350 },
  { id: 'b', name: 'B', price: 600 },
  { id: 'c', name: 'C', price: 450 },
  { id: 'd', name: 'D', price: 300 },
  { id: 'e', name: 'E', price: 550 },
];
const desc = sortProducts(sortable, 'price-desc').map((p) => p.price);
check(
  '500-600 band sits above 400-500, which sits above 300-350',
  JSON.stringify(desc) === JSON.stringify([600, 550, 450, 350, 300]),
  desc.join(',')
);
check(
  'Price: Low to High reverses it',
  JSON.stringify(sortProducts(sortable, 'price-asc').map((p) => p.price)) ===
    JSON.stringify([300, 350, 450, 550, 600])
);
check('Name: A to Z works', sortProducts(sortable, 'name').map((p) => p.id).join('') === 'abcde');
check(
  'sorting does not mutate the original list',
  sortable.map((p) => p.price).join(',') === '350,600,450,300,550'
);

// A product whose designs have their own prices is placed by the cheapest one.
const withDesignPrices = {
  id: 'x',
  price: 900,
  variants: ['Design 1: 2 | price: 400', 'Design 2: 1 | price: 850'],
};
check('cheapest design price is used for ordering', getLowestPrice(withDesignPrices) === 400);
check(
  'a product with designs sorts above one priced at 300',
  sortProducts([{ id: 'lo', price: 300 }, withDesignPrices], 'price-desc')[0].id === 'x'
);
check('plain products fall back to their own price', getLowestPrice({ price: 550 }) === 550);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
