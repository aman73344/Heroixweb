import { Star } from "lucide-react";
import { hasRealRating, normalizeRating, normalizeReviewCount } from "@/lib/reviews";

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
  const value = normalizeRating(rating);
  const reviewCount = normalizeReviewCount(reviews);
  // A score is only shown when it is backed by real reviews. Filled stars for a
  // product nobody has rated (rating 4.5 / reviews 0) is exactly the fake
  // "4.5 (0)" this component replaced.
  const hasReviews = hasRealRating(rating, reviews);
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
