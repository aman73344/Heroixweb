"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SmartImage } from "@/components/smart-image";
import { IMAGE_SIZES } from "@/lib/image-url";
import { usePreloadBudget } from "@/hooks/use-preload-budget";

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
 *
 * HOW MANY PICTURES THIS MAY DOWNLOAD
 * Only the picture on screen, plus the next one when the connection allows it.
 * This used to render the whole list stacked and rely on `loading="lazy"`, which
 * changed nothing: a browser fetches an <img> that is merely transparent or
 * behind another slide, so a single card could pull six 785 KB originals out of
 * Supabase Storage before anyone tapped it, and the home page paid that for all
 * seventy products. Mounting is what decides a request - a picture that is not
 * in the tree costs nothing.
 *
 * The pictures themselves are small WebP derivatives (see lib/image-url.ts), so
 * what is left is a thumbnail-sized request per card instead of a full gallery.
 */
export function ProductImageCarousel({
  images,
  productName,
  productImage,
  variantImages = [],
  heightClass = "h-48",
  priority = false,
}: {
  images?: string[];
  productName: string;
  productImage?: string;
  variantImages?: VariantPicture[];
  heightClass?: string;
  /**
   * True only for the cards that are actually on screen when the grid paints.
   * Before this existed every card marked its first picture `eager` +
   * `fetchPriority="high"`, which is 70 competing high-priority requests on the
   * home page and made every one of them slow.
   */
  priority?: boolean;
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

  // Memoised so the list identity is stable across renders: `mountedIndexes`
  // and the "keep the index valid" effect both depend on it, and a fresh array
  // on every render would make the carousel think the picture set changed.
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

  // --- Which pictures may be in the DOM at all ------------------------------
  // A picture that is mounted is a picture the browser downloads, whatever its
  // opacity or position. So the active one always, and the next one only when
  // the connection says there is headroom; everything further away waits for the
  // customer to actually go there (via an arrow, a dot or a swipe), at which
  // point it is mounted and starts loading on the spot.
  const preloadBudget = usePreloadBudget();

  // Keyed by URL, not by index: a design switch replaces the picture at an index
  // with a different one, and index-keyed state reported the old picture as
  // "already loaded" and skipped straight to hiding it.
  const [settled, setSettled] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);

  // The picture list can change (product/design switch), so keep the index valid.
  useEffect(() => {
    if (currentImageIndex > imageList.length - 1) setCurrentImageIndex(0);
  }, [imageList.length, currentImageIndex]);

  const mountedIndexes = useMemo(() => {
    const set = new Set<number>([currentImageIndex]);
    if (preloadBudget > 0 && imageList.length > 1) {
      set.add((currentImageIndex + 1) % imageList.length);
    }
    return set;
  }, [currentImageIndex, imageList.length, preloadBudget]);

  const markSettled = (src: string) =>
    setSettled((prev) => (prev[src] ? prev : { ...prev, [src]: true }));

  // The active picture is worth a spinner; a warmed-up neighbour is not going to
  // be looked at yet, so it never shows one.
  const activePending = displayImage ? settled[displayImage] === undefined : false;

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
          {/* Only the pictures in `mountedIndexes` exist in the DOM. Keys are
              stable, so an arrow tap does not unmount and remount a picture that
              is already there - which is what used to make the arrows feel like
              they stalled while the browser re-requested the file. */}
          {imageList.map((src, idx) =>
            mountedIndexes.has(idx) ? (
              <SmartImage
                key={`${src}-${idx}`}
                src={src}
                cssWidth={384}
                sizes={IMAGE_SIZES.card}
                alt={idx === currentImageIndex ? productName : ""}
                aria-hidden={idx !== currentImageIndex}
                // The picture on screen now is the one the customer is waiting
                // for; everything else waits for the viewport.
                loading={idx === currentImageIndex && priority ? "eager" : "lazy"}
                fetchPriority={idx === currentImageIndex && priority ? "high" : "auto"}
                className={`absolute inset-0 w-full h-full object-contain transition-[opacity,transform,filter] duration-500 ease-out group-hover:scale-105 touch:brightness-105 select-none [-webkit-user-drag:none] ${
                  idx === currentImageIndex ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                // Inline opacity, so this never collides with the class above.
                style={{ zIndex: idx === currentImageIndex ? 1 : 0 }}
                onLoad={() => markSettled(src)}
              />
            ) : null
          )}

          {/* Spinner while the active picture is still downloading. */}
          {activePending && (
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
