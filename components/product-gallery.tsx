"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
 * Every picture is rendered stacked rather than swapping a single <img> src.
 * Swapping src re-downloads the file on every tap, which is what made moving
 * between pictures feel laggy on a phone; with them all in the DOM the browser
 * fetches them up front and switching is instant.
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
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  // Keep the index valid when the picture list changes (design switch).
  useEffect(() => {
    if (index > images.length - 1) onIndexChange(0);
  }, [index, images.length, onIndexChange]);

  // Preload the neighbours so the next/previous tap is instant.
  useEffect(() => {
    if (images.length <= 1 || typeof window === "undefined") return;
    const neighbours = [
      images[(safeIndex + 1) % images.length],
      images[(safeIndex - 1 + images.length) % images.length],
    ];
    for (const src of neighbours) {
      if (!src) continue;
      const preloader = new window.Image();
      preloader.src = src;
    }
  }, [safeIndex, images]);

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
      {images.map((src, idx) => (
        <img
          key={`${src}-${idx}`}
          src={src}
          alt={idx === safeIndex ? alt : ""}
          aria-hidden={idx !== safeIndex}
          // The first picture is what the customer sees first: fetch it ASAP.
          loading={idx === 0 ? "eager" : "lazy"}
          fetchPriority={idx === 0 ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoaded((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }))}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
            idx === safeIndex ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{ zIndex: idx === safeIndex ? 1 : 0 }}
        />
      ))}

      {/* Spinner instead of a blank frame while the picture downloads. */}
      {loaded[safeIndex] === false && (
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