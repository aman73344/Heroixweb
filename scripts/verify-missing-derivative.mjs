// Checks the "a derivative is missing" ladder in lib/image-url.ts, which is pure
// and needs no browser. The bug this exists for: a missing 800px used to mark the
// WHOLE picture as derivative-less, so the browser was sent to the 785 KB original
// even though a working 400px was sitting right next to it.
//
// Run:  node scripts/verify-missing-derivative.mjs

import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

register('./ts-resolve-hooks.mjs', import.meta.url);

// Node only learned to import a .ts file by itself in 22.18. Re-running once with
// the flag is the same trick scripts/generate-image-derivatives.mjs uses, so this
// works on a plain `node` instead of making every caller remember the flag.
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
    ['--experimental-strip-types', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
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

const {
  imageSrcSet,
  imageUrl,
  previewUrl,
  availableWidths,
  derivativeWidthFromUrl,
  noteMissingDerivative,
  resetMissingDerivatives,
} = await import('../lib/image-url.ts');

const ORIGIN = 'https://example.supabase.co/storage/v1/object/public/products';
const SRC = `${ORIGIN}/prod-1/1234-1.jpeg`;
const original = `${ORIGIN}/prod-1/1234-1.jpeg`;
const at = (w) => `${ORIGIN}/_thumbs/prod-1/1234-1.jpeg@${w}.webp`;

// A local placeholder is not a Storage object and must never get a srcset.
const NOT_STORAGE = '/placeholder.jpg';

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'ok  ' : 'FAIL'}  ${label}` +
      (ok ? '' : `\n          expected ${e}\n          actual   ${a}`),
  );
};

// 1. Nothing missing: every tier offered, and each slot picks the smallest
//    tier that still covers its 2x target (40px chip -> 200, ~190px DPR2 card
//    maths -> 400, 384px gallery slot at 2x -> 800).
resetMissingDerivatives();
check('availableWidths with nothing missing', availableWidths(SRC), [200, 400, 600, 800]);
check(
  'srcset offers every tier',
  imageSrcSet(SRC),
  `${at(200)} 200w, ${at(400)} 400w, ${at(600)} 600w, ${at(800)} 800w`,
);
check('a 384px slot picks the 800px tier', imageUrl(SRC, 384), at(800));
check('a 190px slot (home card maths) picks 400', imageUrl(SRC, 190), at(400));
check('a 40px slot picks the 200px tier', imageUrl(SRC, 40), at(200));
check('preview defaults to the 200px file', previewUrl(SRC), at(200));
check('the gallery pins its preview to 400px', previewUrl(SRC, 400), at(400));

// 2. THE REGRESSION THIS FIXES: the 800px tier is missing, the rest are not.
noteMissingDerivative(SRC, 800);
check('surviving widths after 800px fails', availableWidths(SRC), [200, 400, 600]);
check('srcset drops the missing 800px', imageSrcSet(SRC), `${at(200)} 200w, ${at(400)} 400w, ${at(600)} 600w`);
check('NO original is requested for a 384px slot - 600 covers it', imageUrl(SRC, 384), at(600));
check('preview still available', previewUrl(SRC), at(200));

// 3. The reverse: 400px missing, the others fine. The gallery still has its
//    picture, and only the pinned 400px preview is lost - not the frame.
resetMissingDerivatives();
noteMissingDerivative(SRC, 400);
check('surviving widths after 400px fails', availableWidths(SRC), [200, 600, 800]);
check('a 384px slot still gets the 800px', imageUrl(SRC, 384), at(800));
check('the 200px default preview survives', previewUrl(SRC), at(200));
check('the pinned 400px preview is null but the page is not empty', previewUrl(SRC, 400), null);

// 4. Only when EVERY tier is gone does the original become the answer.
resetMissingDerivatives();
for (const w of [200, 400, 600, 800]) noteMissingDerivative(SRC, w);
check('no widths left', availableWidths(SRC), []);
check('falls back to the original as a last resort', imageUrl(SRC, 384), original);
check('srcset is empty so the original is used', imageSrcSet(SRC), '');
check('preview is null', previewUrl(SRC), null);

// 5. A failure with no width recorded is still treated as "all of them gone".
resetMissingDerivatives();
noteMissingDerivative(SRC);
check('unattributed failure drops every width', availableWidths(SRC), []);
check('unattributed failure uses the original', imageUrl(SRC, 384), original);

// 6. Blaming a tier: which candidate did the browser actually fail on?
resetMissingDerivatives();
check('800px candidate blames the 800 tier', derivativeWidthFromUrl(SRC, at(800)), 800);
check('600px candidate blames the 600 tier', derivativeWidthFromUrl(SRC, at(600)), 600);
check('400px candidate blames the 400 tier', derivativeWidthFromUrl(SRC, at(400)), 400);
check('200px candidate blames the 200 tier', derivativeWidthFromUrl(SRC, at(200)), 200);
check('the original blames no tier', derivativeWidthFromUrl(SRC, original), null);
check('an empty currentSrc blames no tier', derivativeWidthFromUrl(SRC, ''), null);
check('a query string does not confuse it', derivativeWidthFromUrl(SRC, `${at(800)}?v=2`), 800);
check('an unrelated url blames no tier', derivativeWidthFromUrl(SRC, `${ORIGIN}/other.jpeg`), null);

// 7. One picture's failure must not leak into another.
resetMissingDerivatives();
const OTHER = `${ORIGIN}/prod-2/9999-1.jpeg`;
noteMissingDerivative(SRC, 800);
check('a different picture is unaffected', availableWidths(OTHER), [200, 400, 600, 800]);
check(
  'and still gets every tier',
  imageSrcSet(OTHER),
  `${ORIGIN}/_thumbs/prod-2/9999-1.jpeg@200.webp 200w, ${ORIGIN}/_thumbs/prod-2/9999-1.jpeg@400.webp 400w, ${ORIGIN}/_thumbs/prod-2/9999-1.jpeg@600.webp 600w, ${ORIGIN}/_thumbs/prod-2/9999-1.jpeg@800.webp 800w`,
);

// 8. Non-Storage pictures are untouched by any of this.
resetMissingDerivatives();
check('a local placeholder gets no srcset', imageSrcSet(NOT_STORAGE), '');
check('a local placeholder is returned untouched', imageUrl(NOT_STORAGE, 384), NOT_STORAGE);
check('a local placeholder has no preview', previewUrl(NOT_STORAGE), null);

// 9. NEXT_PUBLIC_IMAGES_CDN_BASE moves derivative URLs to the CDN (Cloudflare
//    R2) with the SAME keys - and the last-resort original stays on Supabase,
//    so the site keeps showing pictures even if the CDN is misconfigured.
//    The env var is read at module load, so a query-string re-import gets a
//    fresh module instance to test it against (section 1-8 ran with it unset,
//    which is also the deployed default before the CDN exists).
// The CDN base is the bucket's public HOST root: an R2 public bucket binds the
// bucket to the host, so the bucket name is not a path segment and the key after
// the host is the in-bucket key the mirror uploaded (matches lib/image-url.ts).
const CDN = 'https://pub-abc123.r2.dev';
process.env.NEXT_PUBLIC_IMAGES_CDN_BASE = CDN;
const cdn = await import('../lib/image-url.ts?cdn');
delete process.env.NEXT_PUBLIC_IMAGES_CDN_BASE;
check(
  'srcset moves to the CDN base with identical keys',
  cdn.imageSrcSet(SRC),
  `${CDN}/_thumbs/prod-1/1234-1.jpeg@200.webp 200w, ${CDN}/_thumbs/prod-1/1234-1.jpeg@400.webp 400w, ${CDN}/_thumbs/prod-1/1234-1.jpeg@600.webp 600w, ${CDN}/_thumbs/prod-1/1234-1.jpeg@800.webp 800w`,
);
check(
  'a gallery slot still picks the 800 tier on the CDN',
  cdn.imageUrl(SRC, 384),
  `${CDN}/_thumbs/prod-1/1234-1.jpeg@800.webp`,
);
for (const w of [200, 400, 600, 800]) cdn.noteMissingDerivative(SRC, w);
check('the last-resort original stays on Supabase', cdn.imageUrl(SRC, 384), original);

console.log(
  failures === 0
    ? '\n  All missing-derivative checks passed.\n'
    : `\n  ${failures} check(s) failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);