// Ratings and review counts are REAL customer feedback, so nothing in the app
// may invent them. These helpers are the single place that turns whatever is
// stored in the database (number, numeric string, null, NaN, out of range) into a
// safe value:
//
//   - a missing rating becomes 0, never a flattering default like 4.5
//   - a missing review count becomes 0, which the UI renders as
//     "No reviews yet" instead of a fake "4.5 (0)"
//
// Before this, six different save/read paths each wrote their own
// `rating: x || 4.5`, so every product ended up looking rated out of the box.

/** The value used when a product has no real rating yet. */
export const NO_RATING = 0;

/** Clamps and parses a stored rating. Returns 0 when there is no real rating. */
export function normalizeRating(value: unknown): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return NO_RATING;
  return Math.min(5, n);
}

/** Parses a stored review count. Returns 0 when there are no real reviews. */
export function normalizeReviewCount(value: unknown): number {
  const n = typeof value === "string" ? parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** True only when a product has a real rating backed by real reviews. */
export function hasRealRating(rating: unknown, reviews: unknown): boolean {
  return normalizeReviewCount(reviews) > 0 && normalizeRating(rating) > 0;
}
