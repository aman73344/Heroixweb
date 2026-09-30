import { getVariantPrice, parseVariants, ProductVariant } from "./variants";

/**
 * How the keychains are ordered in the store grids.
 *
 * The shop's default is "Price: High to Low", so the 500-600 Rs keychains sit
 * above the 400-500 Rs ones, which sit above the 300-350 Rs ones - and so on
 * down to the cheapest. That matches how the price is displayed on the card
 * (which shows "Rs 400 - Rs 900" when a product's designs cost different
 * amounts), so the order and the label always agree.
 */
export type SortKey = "price-desc" | "price-asc" | "newest" | "name";

export interface SortOption {
  value: SortKey;
  label: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: "price-desc", label: "Price: High to Low" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "newest", label: "Newest First" },
  { value: "name", label: "Name: A to Z" },
];

/** What the store shows first unless the customer picks something else. */
export const DEFAULT_SORT: SortKey = "price-desc";

/**
 * The lowest price a customer can actually pay for a keychain: the cheapest of
 * the product's own designs when it has several, otherwise the product price.
 *
 * Sorting on the cheapest design keeps a product whose designs span Rs 400-900
 * in the "from Rs 400" band, which is where a shopper would expect to find it.
 */
export function getLowestPrice(
  product: { price?: number | null; variants?: unknown },
  defaultStock = 0
): number {
  const base = Number(product?.price) || 0;

  let designs: ProductVariant[] = [];
  try {
    designs = parseVariants(product?.variants, defaultStock);
  } catch {
    designs = [];
  }

  const designPrices = designs
    .map((d) => getVariantPrice(d, base))
    .filter((p) => p > 0);

  if (designPrices.length === 0) return base;
  return Math.min(base > 0 ? base : Infinity, ...designPrices);
}

/** Sorts products without mutating the original array. */
export function sortProducts<T extends { price?: number | null; variants?: unknown }>(
  products: T[],
  sortKey: SortKey = DEFAULT_SORT,
  defaultStock = 0
): T[] {
  const items = [...products];

  switch (sortKey) {
    case "price-asc":
      return items.sort(
        (a, b) => getLowestPrice(a, defaultStock) - getLowestPrice(b, defaultStock)
      );

    case "newest":
      return items.sort((a, b) => {
        const at = Date.parse(String((a as any).created_at || "")) || 0;
        const bt = Date.parse(String((b as any).created_at || "")) || 0;
        return bt - at;
      });

    case "name":
      return items.sort((a, b) =>
        String((a as any).name || "").localeCompare(String((b as any).name || ""))
      );

    case "price-desc":
    default:
      // Most expensive first: the 500-600 Rs band lands above 400-500, which
      // lands above 300-350.
      return items.sort(
        (a, b) => getLowestPrice(b, defaultStock) - getLowestPrice(a, defaultStock)
      );
  }
}