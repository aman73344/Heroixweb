"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface VariantPicture {
  name: string;
  image: string;
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
  let imageList: string[] = [];
  if (images && images.length > 0) {
    imageList = images.filter(Boolean);
  } else if (productImage) {
    imageList = [productImage];
  }

  // Append the design pictures that are not already in the list.
  const variantPictures = variantImages.filter((v) => v.image && !imageList.includes(v.image));
  imageList = [...imageList, ...variantPictures.map((v) => v.image)];

  const hasMultipleImages = imageList.length > 1;
  const displayImage = imageList[currentImageIndex] || null;
  const currentVariantLabel = displayImage
    ? variantPictures.find((v) => v.image === displayImage)?.name || ""
    : "";

  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? imageList.length - 1 : prev - 1));
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === imageList.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={`relative ${heightClass} bg-card/50 overflow-hidden group flex items-center justify-center`}>
      {displayImage ? (
        <>
          <img
            src={displayImage}
            alt={productName}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-6xl font-black text-accent/30 hidden">
            â˜…
          </div>

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
              <button
                onClick={goToPrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-accent/90 hover:bg-accent text-accent-foreground p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent/90 hover:bg-accent text-accent-foreground p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
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
                        : "bg-white/50 hover:bg-white/80"
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
          â˜…
        </div>
      )}
    </div>
  );
}

/** Flattens a product's designs into the picture list the carousel cycles through. */
export function collectVariantPictures(
  variants: { name: string; images?: string[]; image?: string }[]
): VariantPicture[] {
  const out: VariantPicture[] = [];
  for (const v of variants) {
    for (const img of v.images && v.images.length > 0 ? v.images : v.image ? [v.image] : []) {
      out.push({ name: v.name, image: img });
    }
  }
  return out;
}
