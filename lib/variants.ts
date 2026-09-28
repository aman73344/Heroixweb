// Helper functions for parsing and serializing product variants with individual stock counts,
// pictures and descriptions.
// Variants can be stored in Supabase as a text array with formats like:
//   "Red: 5"
//   "Classic Red (stock: 5)"
//   "Black Suit: 5 | image: https://..."
//   "Vegeta Super Saiyan: 4 | image: https://... | desc: Golden hair, screaming pose"
// or as JSON objects {"name":"Red","stock":5,"image":"https://...","description":"..."}.

export interface ProductVariant {
  name: string;
  stock: number;
  image?: string;
  /** Up to 3 pictures for this design. `image` is always the first one. */
  images?: string[];
  description?: string;
}

/** How many pictures a single design/variant may have. */
export const MAX_VARIANT_IMAGES = 3;

// Keys understood inside a variant string, e.g. "| image: url" / "| desc: text".
const IMAGE_KEYS = ['image', 'img', 'picture', 'pic', 'photo'];
const IMAGE_LIST_KEYS = ['images', 'pictures', 'photos', 'gallery'];
const DESCRIPTION_KEYS = ['desc', 'description', 'about', 'details', 'info', 'note'];

/** Normalises a design's pictures: de-duped, max 3, first one is the main image. */
export function normalizeVariantImages(
  ...sources: (string | string[] | undefined | null)[]
): string[] {
  const out: string[] = [];
  for (const source of sources) {
    const values = Array.isArray(source) ? source : source ? [source] : [];
    for (const value of values) {
      // Accepts both a bare url and a comma separated list of urls.
      for (const piece of String(value).split(',')) {
        const url = piece.trim();
        if (!url || !looksLikeImage(url)) continue;
        if (!out.includes(url) && out.length < MAX_VARIANT_IMAGES) out.push(url);
      }
    }
  }
  return out;
}

/** All pictures of a design (falls back to the single `image` field). */
export function getVariantImages(variant: ProductVariant | null | undefined): string[] {
  if (!variant) return [];
  return normalizeVariantImages(variant.images, variant.image);
}

function looksLikeImage(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
}

function mainLooksLikeStockCounter(value: string): boolean {
  return (
    /^(.+?)\s*[:=]\s*\d+\s*$/.test(value) ||
    /^(.+?)\s+-\s+\d+\s*$/.test(value) ||
    /^(.+?)\s*\(\s*(?:stock\s*:\s*)?\d+(?:\s*left)?\s*\)\s*$/i.test(value)
  );
}

/**
 * Splits a stored variant string into the main part ("Name: Stock") plus the
 * optional picture and description attributes:
 *   "Vegeta Blue: 6 | image: https://img.png | desc: Blue haired form"
 * Unknown/plain trailing text after the stock counter is treated as the
 * description, so "Vegeta Blue: 6 | Blue haired form" also works.
 */
export function parseVariantAttributes(raw: string): {
  main: string;
  image?: string;
  images?: string[];
  description?: string;
} {
  const str = (raw || '').trim();
  if (str.indexOf('|') === -1) return { main: str };

  const segments = str.split('|').map((segment) => segment.trim()).filter(Boolean);
  const mainParts: string[] = [];
  const imageList: string[] = [];
  let description: string | undefined;
  let descriptionStarted = false;

  for (const segment of segments) {
    // Old admin data wrote "Name: 5 | https://cdn/pic.png" - a bare picture URL must
    // be recognised before the "key: value" check (otherwise "https" looks like a key).
    if (looksLikeImage(segment)) {
      imageList.push(segment);
      continue;
    }

    const keyed = segment.match(/^([A-Za-z][A-Za-z _-]{0,14})\s*:\s*([\s\S]*)$/);
    const key = keyed ? keyed[1].trim().toLowerCase() : '';
    const value = keyed ? keyed[2].trim() : '';

    if (key && IMAGE_KEYS.includes(key) && value) {
      imageList.push(value);
      continue;
    }
    // Several pictures in one attribute: "images: url1, url2, url3"
    if (key && IMAGE_LIST_KEYS.includes(key) && value) {
      value
        .split(',')
        .map((url) => url.trim())
        .filter((url) => url && looksLikeImage(url))
        .forEach((url) => imageList.push(url));
      continue;
    }
    if (key && DESCRIPTION_KEYS.includes(key) && !descriptionStarted) {
      description = value;
      descriptionStarted = true;
      continue;
    }

    if (descriptionStarted) {
      description = description ? `${description} | ${segment}` : segment;
      continue;
    }
    // A free-text segment that follows a complete "Name: stock" counter is the description.
    if (mainParts.length > 0 && mainLooksLikeStockCounter(mainParts.join(' | '))) {
      description = segment;
      descriptionStarted = true;
      continue;
    }
    mainParts.push(segment);
  }

  const images = normalizeVariantImages(imageList);

  return {
    main: mainParts.join(' | ').trim(),
    ...(images.length > 0 ? { image: images[0] } : {}),
    ...(images.length > 0 ? { images } : {}),
    ...(description ? { description } : {}),
  };
}

/**
 * Splits a stored variant string into its main part ("Name: Stock") and the
 * optional picture suffix ("| image: url").
 * The suffix is only stripped when it really looks like a picture URL
 * (http(s):// or a "/"-prefixed path, with or without an "image:" key), so
 * variant names containing "|" still work.
 */
export function splitVariantImageSuffix(raw: string): { main: string; image?: string } {
  const { main, image } = parseVariantAttributes(raw);
  return image ? { main, image } : { main };
}

/**
 * Parses raw variant strings/objects into normalized ProductVariant[].
 * If a variant string has no stock specified (e.g. "Red"), defaultStock is used.
 */
export function parseVariants(rawVariants: any, defaultStock: number = 0): ProductVariant[] {
  if (!rawVariants) return [];
  
  let list: any[] = [];
  if (Array.isArray(rawVariants)) {
    list = rawVariants;
  } else if (typeof rawVariants === 'string') {
    try {
      const parsed = JSON.parse(rawVariants);
      if (Array.isArray(parsed)) list = parsed;
      else list = rawVariants.split('\n');
    } catch {
      list = rawVariants.split('\n');
    }
  }

  const results: ProductVariant[] = [];

  for (const item of list) {
    if (!item) continue;

    // If already an object { name, stock, image }
    if (typeof item === 'object' && item !== null) {
      const name = String(item.name || item.variant || '').trim();
      if (!name) continue;
      const stock = typeof item.stock === 'number' ? item.stock : parseInt(String(item.stock), 10);
      const images = normalizeVariantImages(item.images, item.pictures, item.image);
      const primaryImage = item.image ? String(item.image).trim() : images[0];
      const description = item.description || item.desc || item.about
        ? String(item.description || item.desc || item.about).trim()
        : undefined;
      results.push({
        name,
        stock: isNaN(stock) ? defaultStock : Math.max(0, stock),
        ...(primaryImage ? { image: primaryImage } : {}),
        ...(images.length > 0 ? { images } : {}),
        ...(description ? { description } : {}),
      });
      continue;
    }

    if (typeof item !== 'string') continue;
    const str = item.trim();
    if (!str) continue;

    // Check if JSON string
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const obj = JSON.parse(str);
        if (obj && (obj.name || obj.variant)) {
          const name = String(obj.name || obj.variant).trim();
          const stock = typeof obj.stock === 'number' ? obj.stock : parseInt(String(obj.stock), 10);
          const images = normalizeVariantImages(obj.images, obj.pictures, obj.image);
          const primaryImage = obj.image ? String(obj.image).trim() : images[0];
          const description = obj.description || obj.desc || obj.about
            ? String(obj.description || obj.desc || obj.about).trim()
            : undefined;
          results.push({
            name,
            stock: isNaN(stock) ? defaultStock : Math.max(0, stock),
            ...(primaryImage ? { image: primaryImage } : {}),
            ...(images.length > 0 ? { images } : {}),
            ...(description ? { description } : {}),
          });
          continue;
        }
      } catch {
        // Fall back to line regex
      }
    }

    // Check for "Name: Stock | image: url" or "Name: Stock" or "Name | image: url"
    let name = str;
    let stock = defaultStock;

    // Split off the optional "| image: url" / "| images: a, b, c" and "| desc: text"
    // suffixes.
    const { main: mainPart, image, images, description } = parseVariantAttributes(str);

    // Regex 1: "Name: 5" or "Name:5"
    const colonMatch = mainPart.match(/^(.+?)\s*[:=]\s*(\d+)\s*$/);
    // Regex 2: "Name - 5" or "Name- 5"
    const dashMatch = mainPart.match(/^(.+?)\s+-\s+(\d+)\s*$/);
    // Regex 3: "Name (5)" or "Name (stock: 5)" or "Name (5 left)"
    const parenMatch = mainPart.match(/^(.+?)\s*\(\s*(?:stock\s*:\s*)?(\d+)(?:\s*left)?\s*\)\s*$/i);

    if (colonMatch) {
      name = colonMatch[1].trim();
      stock = parseInt(colonMatch[2], 10);
    } else if (dashMatch) {
      name = dashMatch[1].trim();
      stock = parseInt(dashMatch[2], 10);
    } else if (parenMatch) {
      name = parenMatch[1].trim();
      stock = parseInt(parenMatch[2], 10);
    } else {
      name = mainPart;
    }

    if (name) {
      results.push({
        name,
        stock: isNaN(stock) ? defaultStock : Math.max(0, stock),
        ...(image ? { image } : {}),
        ...(images && images.length > 0 ? { images } : {}),
        ...(description ? { description } : {}),
      });
    }
  }

  return results;
}

/**
 * Serializes ProductVariant[] back to string format for storage/input:
 * "Name: Stock" or "Name: Stock | image: url" or
 * "Name: Stock | image: url | desc: text"
 */
export function formatVariantsForStorage(variants: ProductVariant[]): string[] {
  return variants.map((v) => variantToLine(v));
}

/**
 * Serializes ProductVariant[] to textarea text (one variant per line).
 */
export function formatVariantsForTextarea(variants: ProductVariant[]): string {
  return variants.map((v) => variantToLine(v)).join('\n');
}

function variantToLine(variant: ProductVariant): string {
  const parts = [`${variant.name}: ${variant.stock}`];
  const images = getVariantImages(variant);
  if (images.length === 1) {
    // A single picture keeps the short, backwards-compatible "| image: url" form.
    parts.push(`image: ${images[0]}`);
  } else if (images.length > 1) {
    // Several pictures: the first one stays the main image, the extras follow as a list.
    parts.push(`image: ${images[0]}`);
    parts.push(`images: ${images.slice(1).join(', ')}`);
  }
  if (variant.description) parts.push(`desc: ${variant.description.replace(/\s+/g, ' ').trim()}`);
  return parts.join(' | ');
}

/**
 * Calculate total stock across all variants if variants exist and have stock,
 * otherwise return the product's base stock.
 */
export function calculateEffectiveStock(baseStock: number, variants: ProductVariant[]): number {
  if (!variants || variants.length === 0) return baseStock;
  return variants.reduce((sum, v) => sum + v.stock, 0);
}
