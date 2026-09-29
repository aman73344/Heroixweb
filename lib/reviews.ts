// Ratings and review counts for the store.
//
// The shop shows a default rating (DEFAULT_RATING, e.g. 4.8) on every product
// so the catalogue never looks empty, and the admin can set a real rating and
// review count per product whenever the actual customer feedback is available.
// This module is the single place that turns whatever is stored in the database
// (number, numeric string, null, NaN, out of range) into a safe value, so the
// six save/read paths can never disagree again.

/**
 * The default rating shown when a product has no rating of its own yet.
 * Change it here to change it everywhere in the store.
 */
export const DEFAULT_RATING = 4.8;

/** The default review count shown next to the rating. */
export const DEFAULT_REVIEW_COUNT = 0;

/**
 * Clamps and parses a stored rating. Falls back to DEFAULT_RATING so a product
 * without a rating of its own still shows a proper star rating.
 */
export function normalizeRating(
  value: unknown,
  fallback: number = DEFAULT_RATING
): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(5, n);
}

/** Parses a stored review count, falling back to DEFAULT_REVIEW_COUNT. */
export function normalizeReviewCount(
  value: unknown,
  fallback: number = DEFAULT_REVIEW_COUNT
): number {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/** True when the product's rating comes from the store's own data. */
export function hasOwnRating(rating: unknown): boolean {
  const n = typeof rating === "string" ? parseFloat(rating) : Number(rating);
  return Number.isFinite(n) && n > 0;
}

