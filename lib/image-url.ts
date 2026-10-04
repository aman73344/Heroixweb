// ONE place that decides which file a picture is downloaded from.
//
// WHY THIS FILE EXISTS
// Heroix stores full-resolution originals in Supabase Storage (a 1080x1350 JPEG
// weighs roughly 785 KB). Every one of those originals used to be downloaded for
// a 40x40 or 384px slot in the UI, so the Supabase free-plan egress allowance was
// spent on pixels nobody ever saw.
//
// Supabase's own image transformations (`/storage/v1/render/image/...`) were
// checked against this project and return HTTP 403 - they are a paid feature and
// this project is on the free plan. So resizing has to happen before the file
// reaches Storage, not at request time.
//
// THE APPROACH
// `scripts/generate-image-derivatives.mjs` walks the catalogue once, re-encodes
// every picture to WebP at a couple of fixed widths, and uploads the result next
// to the original under a `_thumbs/` prefix in the SAME public bucket. Nothing
// else in the app has to change: no new bucket, no new provider, no new runtime
// dependency, and deleting the `_thumbs/` folder reverts everything.
//
//   original   .../object/public/products/prod-17/1776162067135-1.jpeg
//   thumbnail  .../object/public/products/_thumbs/prod-17/1776162067135-1.jpeg@400.webp
//   gallery    .../object/public/products/_thumbs/prod-17/1776162067135-1.jpeg@800.webp
//
// This module is the single source of truth for that mapping. The generator
// imports THIS file (through scripts/ts-resolve-hooks.mjs) rather than repeating
// the rule, so the two can never drift apart.
//
// Anything that is not a Supabase Storage object (a /placeholder.jpg, an external
// URL) is returned untouched and gets NO srcset: a srcset whose candidates are
// all the same full-size file would only make the browser download that full-size
// file with extra steps.

/** Folder inside the bucket that holds the generated derivatives. */
export const THUMBNAIL_FOLDER = "_thumbs";

/**
 * Widths the generator produces, smallest first.
 *
 * 400px covers every thumbnail, design chip and cart line (all of them are 40-80
 * CSS px, so 400 is still 5-10x denser than they need at 1x and sharp at 2x).
 * 800px covers the product-card carousel and the product-page gallery, whose
 * widest slot is 384 CSS px (2x = 768).
 *
 * A third, larger tier is deliberately NOT generated: the originals are only
 * 1080px wide, so a 1600px "detail" tier would be an upscaled copy costing
 * another ~470 KB per picture in the bucket for zero extra sharpness. Add a
 * number here and re-run the generator if bigger artwork is added later.
 */
export const IMAGE_WIDTHS = [400, 800] as const;

export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

/**
 * The `sizes` attribute to pair with each slot, so the browser can pick the
 * right candidate instead of always taking the largest one.
 *
 * These mirror the real Tailwind layouts (the card grid is 1 / 2 / 3 columns at
 * the sm / lg breakpoints, inside a max-w-7xl container with px-4). They are
 * hints only: a wrong guess costs one candidate, never a broken layout, because
 * every slot is a fixed-height box that reserves its own space.
 */
export const IMAGE_SIZES = {
  /** Product card carousel: the h-48 image area of a grid card. */
  card: "(min-width: 1024px) 24rem, (min-width: 640px) 46vw, 92vw",
  /** The 40px design chip strip under a product card. */
  designChip: "40px",
  /** The 48px per-picture chips inside a design card on the product page. */
  designPictureChip: "48px",
  /** A design card in the "Choose Your Design" grid (aspect-square). */
  designCard: "(min-width: 1024px) 17rem, (min-width: 640px) 45vw, 92vw",
  /** The 64px chip in the "Selected design" summary. */
  designSummary: "64px",
  /** The 80px line item on the checkout page. */
  cartLine: "80px",
  /** The h-96 hero picture on a product page. */
  gallery: "(min-width: 1024px) 38rem, 92vw",
} as const;

/** A Supabase public-storage object, split into its parts. */
export interface StorageObject {
  /** `https://<ref>.supabase.co/storage/v1/object/public` */
  base: string;
  /** The bucket the object lives in, e.g. `products`. */
  bucket: string;
  /** The key inside that bucket, e.g. `prod-17/1776162067135-1.jpeg`. */
  key: string;
  /** `bucket/key` - how the object appears in its public URL. */
  path: string;
}

/** The smallest generated width - the right choice for any tiny slot. */
export const THUMBNAIL_WIDTH = IMAGE_WIDTHS[0];

/**
 * Splits a public Storage URL into its parts, or returns null when the URL is
 * not a Supabase Storage object (a local /placeholder.jpg, or an image hosted
 * somewhere else).
 *
 * Query strings are kept out of the key on purpose: a signed or versioned url
 * still points at the same object, and the derivative key is the object.
 */
export function parseStorageObject(src: string | null | undefined): StorageObject | null {
  if (!src || typeof src !== "string") return null;
  // Already a derivative: never re-wrap one, or the key would nest forever.
  if (src.includes(`/${THUMBNAIL_FOLDER}/`)) return null;

  const match = src.match(/^(https?:\/\/[^/+\s]+)\/storage\/v1\/object\/public\/(.+)$/);
  if (!match) return null;
  const [, host, rest] = match;
  if (!host || !rest) return null;

  const [rawPath] = rest.split("?");
  const [bucket, ...keyParts] = (rawPath || "").split("#")[0]!.trim().split("/");
  const key = keyParts.join("/").trim();
  if (!bucket || !key) return null;

  return { base: `${host}/storage/v1/object/public`, bucket, key, path: `${bucket}/${key}` };
}

/**
 * Where a given width of a given object lives, as a key INSIDE the bucket:
 * `_thumbs/prod-17/1776162067135-1.jpeg@400.webp`.
 *
 * The bucket is deliberately NOT repeated inside the folder. Both the upload
 * call and the public URL are built from this one function plus `object.bucket`,
 * so the generator and the UI cannot drift apart on where a derivative lives.
 */
export function derivativePath(objectKey: string, width: number): string {
  return `${THUMBNAIL_FOLDER}/${objectKey}@${width}.webp`;
}

/**
 * The derivative URL for `src` at `width`, or null when no derivative applies
 * (not a Storage object, or already a derivative).
 */
export function derivativeUrl(src: string | null | undefined, width: number): string | null {
  const object = parseStorageObject(src);
  if (!object) return null;
  return `${object.base}/${object.bucket}/${derivativePath(object.key, width)}`;
}

/**
 * True when at least one generated tier applies to this URL, i.e. when a srcset
 * would point at genuinely different files rather than repeating one big file.
 */
export function hasDerivatives(src: string | null | undefined): boolean {
  return parseStorageObject(src) !== null;
}

// --- "the derivative is not there (yet)" bookkeeping ------------------------
//
// The generator is a one-off migration, so until it has run for every picture
// some candidate may not exist yet. That is recorded PER WIDTH, not per picture:
// the 800px tier and the 400px tier are separate files, and losing one of them
// says nothing about the other. Marking the whole picture as "no derivatives"
// (which is what this used to do) meant a single missing 800px file sent the
// browser to the 785 KB original even though a perfectly good 400px derivative
// was sitting right next to it - turning one small gap into the most expensive
// download the page can make.
//
// Once the browser reports a failure the exact candidate is remembered, so every
// later read drops it from the srcset and the failure is paid for once instead of
// on every render.

/** Original URL -> the widths whose file the browser has reported missing. */
const missingWidths = new Map<string, Set<number>>();

/**
 * Records that `width` of `src` has no generated derivative.
 *
 * Called with no `width` this keeps the old blunt meaning - every tier of this
 * picture is treated as missing - for callers that genuinely know the whole
 * picture is unavailable.
 */
export function noteMissingDerivative(src: string | null | undefined, width?: number): void {
  if (!src) return;
  const widths = width === undefined ? IMAGE_WIDTHS : [width];
  let missing = missingWidths.get(src);
  if (!missing) {
    missing = new Set<number>();
    missingWidths.set(src, missing);
  }
  for (const w of widths) missing.add(w);
}

/**
 * Which tier `candidateUrl` is, if it is a derivative of `src` at all.
 *
 * <img>.onError does not say which file failed, but `currentSrc` on the element
 * is exactly the file the browser chose and just failed to load, and every
 * derivative key ends in `@<width>.webp`. That is how a failure is attributed to
 * one tier instead of condemning all of them.
 */
export function derivativeWidthFromUrl(
  src: string | null | undefined,
  candidateUrl: string | null | undefined,
): number | null {
  const object = parseStorageObject(src);
  if (!object || !candidateUrl) return null;
  const candidate = candidateUrl.split("?")[0]!;
  for (const width of IMAGE_WIDTHS) {
    if (candidate.endsWith(derivativePath(object.key, width))) return width;
  }
  return null;
}

/**
 * The generated widths still worth offering for `src`: every tier, minus the ones
 * the browser has already reported missing.
 */
export function availableWidths(src: string | null | undefined): number[] {
  if (!hasDerivatives(src)) return [];
  const missing = missingWidths.get(src!);
  if (!missing) return [...IMAGE_WIDTHS];
  return IMAGE_WIDTHS.filter((width) => !missing.has(width));
}

/**
 * True only when nothing smaller than the original is left - the single situation
 * in which falling back to the original is the right answer.
 */
export function isMissingDerivative(src: string | null | undefined): boolean {
  return hasDerivatives(src) && availableWidths(src).length === 0;
}

/** Test seam - clears the "no derivative" memory. */
export function resetMissingDerivatives(): void {
  missingWidths.clear();
}

/**
 * The `srcset` for a picture: one entry per generated width that still exists.
 *
 * A width the browser already reported missing is left out, so a picture whose
 * 800px tier is absent is offered its 400px file and nothing asks for the
 * original. Returns an empty string only when nothing smaller is left or the
 * picture was never a Storage object, which makes <SmartImage> fall back to the
 * untouched original - the correct behaviour for a placeholder or an external
 * image.
 */
export function imageSrcSet(src: string | null | undefined): string {
  const entries: string[] = [];
  for (const width of availableWidths(src)) {
    const url = derivativeUrl(src, width);
    if (url) entries.push(`${url} ${width}w`);
  }
  return entries.join(", ");
}

/**
 * The smallest surviving width that is still dense enough for a `cssWidth`-wide
 * slot on a 2x screen, constrained to `widths`. Falls back to the largest of
 * those, so this always returns something usable.
 */
export function pickDerivativeWidth(cssWidth: number, widths: number[] = IMAGE_WIDTHS as unknown as number[]): number {
  if (widths.length === 0) return 0;
  const target = Math.max(1, cssWidth) * 2;
  for (const width of widths) {
    if (width >= target) return width;
  }
  return widths[widths.length - 1]!;
}

/**
 * A single URL to put in `src`: the smallest surviving tier that still covers the
 * slot, or the original when this picture has no derivatives left. `src` is only
 * a fallback for clients that ignore `srcset`, but it still has to be cheap.
 */
export function imageUrl(src: string, cssWidth: number): string {
  const widths = availableWidths(src);
  if (widths.length === 0) return src;
  const width = pickDerivativeWidth(cssWidth, widths);
  return derivativeUrl(src, width) ?? src;
}

/**
 * The cheap "preview" version of a picture, used to paint a slot instantly while
 * the sharper version is still arriving. Returns null when the picture has no
 * derivative at that width (so the caller falls back to a spinner rather than a
 * blurred nothing), and null when the picture is not a Storage object.
 */
export function previewUrl(
  src: string | null | undefined,
  width: number = THUMBNAIL_WIDTH,
): string | null {
  if (!src) return null;
  if (!availableWidths(src).includes(width)) return null;
  return derivativeUrl(src, width);
}
