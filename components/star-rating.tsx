import { Star } from "lucide-react";
import { normalizeRating, normalizeReviewCount } from "@/lib/reviews";

/**
 * The one place ratings are drawn, so the home grid, the keychain page and the
 * admin list can never drift apart again.
 *
 * A product always shows a proper star rating: its own rating if the admin has
 * set one, otherwise the store default (DEFAULT_RATING, 4.8). The review count
 * is printed only when there is one, so a card reads "4.8" on its own instead
 * of "4.8 (0)".
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
  const fullStars = Math.floor(value);
  const hasHalf = value - fullStars >= 0.25;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="flex gap-0.5"
        role="img"
        aria-label={
          reviewCount > 0
            ? `Rated ${value} out of 5 from ${reviewCount} reviews`
            : `Rated ${value} out of 5`
        }
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const isFull = i < fullStars;
          const isHalf = i === fullStars && hasHalf;
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
          <span className="text-foreground font-semibold">{value}</span>
          {reviewCount > 0 && (
            <>
              {" ("}
              {reviewCount} review{reviewCount === 1 ? "" : "s"}
              {")"}
            </>
          )}
        </span>
      )}
    </div>
  );
}
