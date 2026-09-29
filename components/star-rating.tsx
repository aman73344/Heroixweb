import { Star } from "lucide-react";

/**
 * The one place ratings are drawn, so the home grid, the keychain page and the
 * admin list can never drift apart again.
 *
 * It also fixes how a rating reads: a product with no reviews yet (reviews === 0)
 * used to render as "4.5 (0)" next to four filled stars, which looks like a
 * broken/paid score. It now shows empty stars and "No reviews yet" instead, and
 * only prints "4.8 (12 reviews)" when there really are reviews.
 *
 * Half stars (4.5) are supported through a clipped overlay.
 */
export function StarRating({
  rating,
  reviews,
  size = "w-4 h-4",
  className = "",
  showCount = true,
}: {
  rating?: number | string | null;
  reviews?: number | string | null;
  size?: string;
  className?: string;
  showCount?: boolean;
}) {
  const numericRating = Number(rating);
  const numericReviews = Number(reviews);
  const value = Number.isFinite(numericRating)
    ? Math.min(5, Math.max(0, numericRating))
    : 0;
  const reviewCount = Number.isFinite(numericReviews) && numericReviews > 0 ? numericReviews : 0;
  const hasReviews = reviewCount > 0;
  // With no reviews the stars stay empty - showing filled stars for a score that
  // no customer has given is misleading.
  const shownValue = hasReviews ? value : 0;
  const fullStars = Math.floor(shownValue);
  const hasHalf = shownValue - fullStars >= 0.25;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="flex gap-0.5"
        role="img"
        aria-label={
          hasReviews
            ? `Rated ${value} out of 5 from ${reviewCount} reviews`
            : "No reviews yet"
        }
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const isFull = hasReviews && i < fullStars;
          const isHalf = hasReviews && i === fullStars && hasHalf;
          return (
            <span key={i} className="relative inline-flex">
              <Star className={`${size} text-muted-foreground/40`} />
              {(isFull || isHalf) && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: isHalf ? "50%" : "100%" }}
                  aria-hidden="true"
                >
                  <Star className={`${size} fill-accent text-accent`} />
                </span>
              )}
            </span>
          );
        })}
      </div>

      {showCount && (
        <span className="text-sm text-muted-foreground">
          {hasReviews ? (
            <>
              <span className="text-foreground font-semibold">{value}</span>
              {" ("}
              {reviewCount} review{reviewCount === 1 ? "" : "s"}
              {")"}
            </>
          ) : (
            "No reviews yet"
          )}
        </span>
      )}
    </div>
  );
}
