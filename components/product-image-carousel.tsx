"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface VariantPicture {
  name: string;
  image: string;
  /** Position of the design in the product's design list. */
  designIndex: number;
  /** 1-based position of this picture within that design's own pictures. */
  pictureIndex: number;
  /** How many pictures that design has in total. */
  pictureCount: number;
  stock: number;
}

/**
 * The product card image area used by every product grid (home page and the
 * Related Products grid on a keychain page).
 *
 * It cycles through the product's own photos AND the pictures of its designs,
 * so a keychain with several designs shows all of them right in the grid -
 * with arrows, dots, a counter and the design name badge.
 */
export function ProductImageCarousel({
  images,
  productName,
  productImage,
  variantImages = [],
  heightClass = "h-48",
}: {
  images?: string[];
  productName: string;
  productImage?: string;
  variantImages?: VariantPicture[];
  heightClass?: string;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Support both an images array and a single image.
  const baseImages: string[] =
    images && images.length > 0
      ? images.filter(Boolean)
      : productImage
        ? [productImage]
        : [];

  // Append the design pictures that are not already in the list.
  const variantPictures = variantImages.filter((v) => v.image && !baseImages.includes(v.image));

  // Memoised: a new array on every render would make the preload effect below
  // fire constantly and keep re-downloading pictures.
  const imageList: string[] = useMemo(
    () => [...baseImages, ...variantPictures.map((v) => v.image)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images, productImage, variantImages]
  );

  const hasMultipleImages = imageList.length > 1;
  const displayImage = imageList[currentImageIndex] || null;
  const currentVariantLabel = displayImage
    ? variantPictures.find((v) => v.image === displayImage)?.name || ""
    : "";

  // --- Mobile / slow-network fixes -------------------------------------------
  // Every picture is rendered (stacked) instead of swapping a single <img> src.
  // Swapping src forces a fresh network request per tap, which is what made the
  // arrows feel like they "lagged". Keeping them in the DOM lets the browser
  // fetch them up front, so switching is instant.
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  // The picture list can change (product/design switch), so keep the index valid.
  useEffect(() => {
    if (currentImageIndex > imageList.length - 1) setCurrentImageIndex(0);
  }, [imageList.length, currentImageIndex]);

  // Preload the neighbours so the next/previous tap is instant.
  useEffect(() => {
    if (!hasMultipleImages || typeof window === "undefined") return;
    const neighbours = [
      imageList[(currentImageIndex + 1) % imageList.length],
      imageList[(currentImageIndex - 1 + imageList.length) % imageList.length],
    ];
    for (const src of neighbours) {
      if (!src) continue;
      const img = new window.Image();
      img.src = src;
    }
  }, [currentImageIndex, hasMultipleImages, imageList]);

  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? imageList.length - 1 : prev - 1));
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === imageList.length - 1 ? 0 : prev + 1));
  };

  // Swipe left/right, which is the natural gesture on a phone.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    const end = e.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start === null || end === undefined) return;
    const delta = end - start;
    // A small threshold so a tap is not mistaken for a swipe.
    if (Math.abs(delta) > 45 && hasMultipleImages) {
      if (delta < 0) {
        setCurrentImageIndex((prev) => (prev === imageList.length - 1 ? 0 : prev + 1));
      } else {
        setCurrentImageIndex((prev) => (prev === 0 ? imageList.length - 1 : prev - 1));
      }
    }
  };

  return (
    <div
      className={`relative ${heightClass} bg-card/50 overflow-hidden group flex items-center justify-center`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {displayImage ? (
        <>
          {/* All pictures, stacked. Only the active one is visible, so there is
              no re-download when the customer taps an arrow. */}
          {imageList.map((src, idx) => (
            <img
              key={`${src}-${idx}`}
              src={src}
              alt={idx === currentImageIndex ? productName : ""}
              aria-hidden={idx !== currentImageIndex}
              // The first picture is what the customer sees first: fetch it ASAP.
              loading={idx === 0 ? "eager" : "lazy"}
              fetchPriority={idx === 0 ? "high" : "auto"}
              decoding="async"
              // A draggable image starts dragging before the click fires, so on
              // a phone a tap on the card could end up doing nothing. This is
              // the picture the customer taps most, so it must stay tappable.
              draggable={false}
              onLoad={() =>
                setLoaded((prev) => (prev[idx] ? prev : { ...prev, [idx]: true }))
              }
              // The picture zooms in gently on hover on a laptop, and gets a soft
              // brightness lift on a touch device where there is no hover.
              className={`absolute inset-0 w-full h-full object-contain transition-[opacity,transform,filter] duration-500 ease-out group-hover:scale-105 touch:brightness-105 select-none [-webkit-user-drag:none] ${
                idx === currentImageIndex ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              style={{ zIndex: idx === currentImageIndex ? 1 : 0 }}
            />
          ))}

          {/* Spinner while the active picture is still downloading. */}
          {loaded[currentImageIndex] === false && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
              <div className="h-8 w-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
            </div>
          )}

          {/* Which design is on screen */}
          {currentVariantLabel && (
            <div className="absolute top-2 left-2 bg-accent text-accent-foreground text-[11px] font-semibold px-2 py-1 rounded shadow-lg pointer-events-none z-10 max-w-[70%] truncate">
              {currentVariantLabel}
            </div>
          )}

          {hasMultipleImages && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              {currentImageIndex + 1}/{imageList.length}
            </div>
          )}

          {hasMultipleImages && (
            <>
              {/* Always visible on touch devices: a phone has no hover, so the old
                  opacity-0 + group-hover meant the arrows were never tappable.
                  On desktop they still fade in on hover. */}
              <button
                onClick={goToPrevious}
                className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 bg-accent/90 hover:bg-accent text-accent-foreground p-2 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-300 z-10 shadow-lg active:scale-95"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 bg-accent/90 hover:bg-accent text-accent-foreground p-2 rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-300 z-10 shadow-lg active:scale-95"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {imageList.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentImageIndex
                        ? "bg-accent w-6"
                        : "bg-white/70 hover:bg-white/90"
                    }`}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent flex items-center justify-center text-6xl font-black text-accent/30">
          ★
        </div>
      )}
    </div>
  );
}

/**
 * Flattens a product's designs into the picture list the carousel cycles through.
 *
 * Every design AND every one of its pictures is included, tagged with the
 * design's position (designIndex) and the picture's own position, so callers can
 * label a thumbnail with the right design even when two designs share a name -
 * matching by name alone used to show the wrong design's stock/picture number.
 */
export function collectVariantPictures(
  variants: { name: string; images?: string[]; image?: string; stock?: number }[]
): VariantPicture[] {
  const out: VariantPicture[] = [];
  variants.forEach((v, designIndex) => {
    const list =
      v.images && v.images.length > 0
        ? v.images
        : v.image
          ? [v.image]
          : [];
    list.forEach((image, pictureIdx) => {
      if (!image) return;
      out.push({
        name: v.name,
        image,
        designIndex,
        pictureIndex: pictureIdx + 1,
        pictureCount: list.length,
        stock: typeof v.stock === "number" ? v.stock : 0,
      });
    });
  });
  return out;
}
