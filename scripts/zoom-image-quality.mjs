// Magnifies the busiest part of the same picture at three quality settings so
// compression artefacts can actually be SEEN. Sizes alone cannot tell you whether
// q70 is acceptable - the only honest test is to look at the worst region: fine
// engraving, chain links and the woven fabric, where WebP shows blocking and
// ringing first.
//
// Writes <tmp>/heroix-quality/detail-<quality>.png (each a 3x nearest-neighbour
// zoom of the same crop) plus detail-compare.png (all three side by side).
//
// Run:  node scripts/zoom-image-quality.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const URL =
  'https://tomlwzsafpidbpylkvwu.supabase.co/storage/v1/object/public/products/prod-1776161831372/1776162067135-1.jpeg';
const WIDTH = 800;
const QUALITIES = [78, 70, 65];
const ZOOM = 3;

const outDir = join(tmpdir(), 'heroix-quality');
mkdirSync(outDir, { recursive: true });

const response = await fetch(URL);
if (!response.ok) {
  console.error(`  download failed: HTTP ${response.status}`);
  process.exit(1);
}
const source = Buffer.from(await response.arrayBuffer());

// Resize FIRST, then extract. sharp applies `extract` to the input's own geometry,
// so on a chained pipeline the crop is measured against the ORIGINAL pixels, not
// against the resized ones - doing it the other way round lands outside the frame.
const resized = await sharp(source)
  .rotate()
  .resize({ width: WIDTH, withoutEnlargement: true })
  .toBuffer();
const meta = await sharp(resized).metadata();
console.log(`  source ${WIDTH}px wide, frame ${meta.width}x${meta.height}`);

// The blade engraving and chain sit low and centre-left; a square there contains
// the most high-frequency detail in the picture.
const crop = {
  left: Math.round(meta.width * 0.3),
  top: Math.round(meta.height * 0.55),
  width: Math.min(200, meta.width),
  height: Math.min(200, meta.height),
};
if (crop.top + crop.height > meta.height || crop.left + crop.width > meta.width) {
  console.error(`  crop ${JSON.stringify(crop)} does not fit inside ${meta.width}x${meta.height}`);
  process.exit(1);
}

const tiles = [];
for (const quality of QUALITIES) {
  const webp = await sharp(resized)
    .clone()
    .webp({ quality, effort: 4 })
    .toBuffer();
  const zoomed = await sharp(webp)
    .extract(crop)
    // Nearest neighbour, NOT a smooth resize: a smooth one would blur the very
    // artefacts being judged.
    .resize(crop.width * ZOOM, crop.height * ZOOM, { kernel: 'nearest' })
    .png()
    .toBuffer();
  writeFileSync(join(outDir, `detail-q${quality}.png`), zoomed);
  tiles.push(zoomed);
  console.log(`  q${quality}  zoomed crop written`);
}

const tileWidth = crop.width * ZOOM;
await sharp({
  create: {
    width: tileWidth * tiles.length + 8 * (tiles.length - 1),
    height: crop.height * ZOOM,
    channels: 3,
    background: { r: 255, g: 0, b: 255 },
  },
})
  .composite(tiles.map((input, i) => ({ input, left: i * (tileWidth + 8), top: 0 })))
  .png()
  .toFile(join(outDir, 'detail-compare.png'));

console.log(`\n  compare.png order, left to right: q${QUALITIES.join('  q')}`);
console.log(`  ${ZOOM}x nearest-neighbour zoom of one ${crop.width}x${crop.height} region\n`);