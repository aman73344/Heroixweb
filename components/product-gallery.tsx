"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SmartImage } from "@/components/smart-image";
import { IMAGE_SIZES, imageUrl, previewUrl } from "@/lib/image-url";
import { preloadImage } from "@/lib/image-preloader";
import { usePreloadBudget } from "@/hooks/use-preload-budget";

interface ProductGalleryProps {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Rendered over the picture (e.g. the selected design badge). */
  overlay?: React.ReactNode;
  alt: string;
  className?: string;
}

/**
 * The big picture area on a keychain page.
 *
 * Why this is a separate component: it owns the browser-only state (which
 * pictures have loaded, swipe position, neighbour preloading). Keeping those
 * hooks inside a component that always mounts - instead of in the page after
 * its loading/404 early returns - means the hook order can never change.
 *
 * HOW IT DECIDES WHAT TO DOWNLOAD
 * Three tiers, and only these three:
 *
 *   on screen   a cheap 400px WebP paints immediately, then the sharper 800px
 *               WebP fades in over it. The customer never sees an empty frame,
 *               and never waits on a 785 KB original to find out what they
 *               tapped.
 *   next one    warmed with `preloadImage` when the connection allows it, so an
 *               arrow tap or a swipe is instant.
 *   everything  far away is not in the DOM at all. A product with six pictures
 *               costs two requests on open, not six.
 *
 * This used to render every picture of the gallery stacked and rely on
 * `loading="lazy"`, plus a `new Image()` for both neighbours. Lazy loading does
 * not mean "not downloaded" - opacity, stacking and being one slide away are all
 * still "in the viewport" as far as the browser is concerned - so opening a
 * product pulled its entire gallery out of Supabase Storage straight away.
 */
export function ProductGallery({
  images,
  index,
  onIndexChange,
  overlay,
  alt,
  className = "h-96",
}: ProductGalleryProps) {
  const safeIndex = index >= 0 && index < images.length ? index : 0;
  // Keyed by URL rather than index: picking a design replaces the picture at an
  // index with a different one, and index-keyed state would report the new
  // picture as "already loaded" and hide its thumbnail before it had arrived.
  const [settled, setSettled] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  // How many extra pictures this connection may warm up ahead of the customer.
  const preloadBudget = usePreloadBudget();

  // Keep the index valid when the picture list changes (design switch).
  useEffect(() => {
    if (index > images.length - 1) onIndexChange(0);
  }, [index, images.length, onIndexChange]);

  // The picture on screen, plus the next one when there is headroom. Anything
  // further away is not mounted, so it is not requested either.
  const mountedIndexes = useMemo(() => {
    const set = new Set<number>([safeIndex]);
    if (preloadBudget > 0 && images.length > 1) {
      const next = (safeIndex + 1) % images.length;
      if (next !== safeIndex) set.add(next);
      // Wrapping round to the first picture again is a plausible next move, and
      // it is the one case where a previous visit already left it in the cache.
      if (images.length > 2) set.add(0);
    }
    return set;
  }, [safeIndex, images.length, preloadBudget]);

  // Warm the next picture at its gallery size so an arrow tap is instant.
  // preloadImage ignores anything this page view already asked for, so moving
  // back and forth cannot turn into a stream of duplicate requests.
  useEffect(() => {
    if (typeof window === "undefined" || preloadBudget < 1 || images.length < 2) return;
    preloadImage(imageUrl(images[(safeIndex + 1) % images.length] || "", 384));
  }, [safeIndex, images, preloadBudget]);

  const markSettled = (src: string) =>
    setSettled((prev) => (prev[src] ? prev : { ...prev, [src]: true }));

  const activeSrc = images[safeIndex];
  // The instant cheap version of the visible picture, when one exists. Painted
  // underneath the real one so the frame is never empty while it downloads.
  const activePreview = previewUrl(activeSrc);
  const activePending = activePreview === null && activeSrc ? settled[activeSrc] === undefined : false;

  const hasMultiple = images.length > 1;

  const goPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIndexChange(safeIndex === 0 ? images.length - 1 : safeIndex - 1);
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onIndexChange(safeIndex >= images.length - 1 ? 0 : safeIndex + 1);
  };

  // Swipe left/right - the natural gesture on a phone.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    const end = e.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start === null || end === undefined || !hasMultiple) return;
    const delta = end - start;
    // A small threshold so a tap is not mistaken for a swipe.
    if (Math.abs(delta) < 45) return;
    if (delta < 0) goNext({ stopPropagation: () => {} } as React.MouseEvent);
    else goPrevious({ stopPropagation: () => {} } as React.MouseEvent);
  };

  return (
    <div
      className={`relative ${className} bg-card/50 overflow-hidden group flex items-center justify-center`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {images.map((src, idx) =>
        mountedIndexes.has(idx) ? (
          <div key={`${src}-${idx}`} className="absolute inset-0">
            {/* The cheap preview goes down first and is still fading out when the
                sharper picture arrives, so tapping through pictures never shows
                an empty frame. Inline opacity, because the parent's classes own
                the transition and the two must not fight. */}
            {idx === safeIndex && activePreview && (
              <img
                src={activePreview}
                alt=""
                aria-hidden="true"
                loading="eager"
                decoding="async"
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain select-none [-webkit-user-drag:none]"
                style={{ opacity: settled[src] ? 0 : 1, transition: "opacity 400ms ease-out" }}
              />
            )}
            <SmartImage
              src={src}
              cssWidth={384}
              sizes={IMAGE_SIZES.gallery}
              alt={idx === safeIndex ? alt : ""}
              aria-hidden={idx !== safeIndex}
              // The picture the customer is looking at right now is the only one
              // worth fetching urgently.
              loading={idx === safeIndex ? "eager" : "lazy"}
              fetchPriority={idx === safeIndex ? "high" : "auto"}
              onLoad={() => markSettled(src)}
              // Same gentle zoom as the grid cards: it is the one large image on
              // the page, so a little movement here does more than anywhere else.
              className={`absolute inset-0 w-full h-full object-contain transition-[opacity,transform,filter] duration-500 ease-out group-hover:scale-105 touch:brightness-105 select-none [-webkit-user-drag:none] ${
                idx === safeIndex ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{ zIndex: idx === safeIndex ? 1 : 0 }}
            />
          </div>
        ) : null
      )}

      {/* Spinner instead of a blank frame, but only for pictures that have no
          thumbnail to stand in for them (placeholders, external images). */}
      {activePending && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
          <div className="h-8 w-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        </div>
      )}

      {overlay}

      {/* Arrows are always visible on phones (a touch screen has no hover, so
          the old opacity-0 + group-hover made them unreachable) and still fade
          in on hover on desktop. */}
      {hasMultiple && (
        <>
          <button
            onClick={goPrevious}
            className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/75 text-white p-2.5 rounded-full transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 shadow-lg active:scale-95 z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/75 text-white p-2.5 rounded-full transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 shadow-lg active:scale-95 z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
}