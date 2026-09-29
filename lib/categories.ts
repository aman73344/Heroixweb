// The store's product categories, in the order they should appear in the filter
// bar and the admin category dropdown. "Gaming" and "Others" were added so new
// products can be filed under them; keeping the list here means the home page and
// the admin form can never drift apart again.
export const PRODUCT_CATEGORIES = [
  "Anime",
  "Superhero",
  "Marvel",
  "DC",
  "Sports",
  "Gaming",
  "Others",
] as const;

/** The filter bar always starts with "All". */
export const ALL_CATEGORY = "All";

/** Filter chips: "All" followed by every real category. */
export function getCategoryFilterOptions(
  productCategories?: (string | null | undefined)[]
): string[] {
  const options = [ALL_CATEGORY];
  for (const category of PRODUCT_CATEGORIES) options.push(category);
  // Anything else that exists in the database is still reachable, so a product
  // is never invisible just because its category is not listed above.
  for (const raw of productCategories || []) {
    const category = String(raw || "").trim();
    if (category && !options.includes(category)) options.push(category);
  }
  return options;
}
