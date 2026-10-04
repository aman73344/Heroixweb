// One place that asks the browser to warm a picture, exactly once.
//
// WHY NOT `new Image()` STRAIGHT IN A COMPONENT
// Both <ProductGallery> and <ProductImageCarousel> reacted to their own state
// changes by building a brand new `new window.Image()` every time. React
// re-runs effects whenever their dependencies change identity, so the same file
// could be asked for three or four times in a row, and each one is a separate
// request the browser cannot prove is the same work.
//
// Every warm-up in the app now goes through `preloadImage`, which remembers what
// has already been requested in this page view. Mounting an <img> and preloading
// the same file also share the entry, because the browser's HTTP cache would
// serve the second one anyway - this just stops the wasted request instead of
// relying on that.
//
// The set is intentionally per page view and not persisted. A fresh navigation
// may well want the bytes again, and a long-lived cache of URLs is exactly the
// kind of state that goes stale and silently skips a download that was needed.

const requested = new Set<string>();

/** True when this page view has already asked for `url`. */
export function hasRequestedImage(url: string | null | undefined): boolean {
  return !!url && requested.has(url);
}

/**
 * Warms `url` in the background without adding an element to the page.
 *
 * `low` fetch priority keeps a background warm-up from competing with the
 * picture the customer is actually looking at. Safe to call from an effect with
 * any value: a null/undefined url, a data: url or a re-request are all no-ops.
 */
export function preloadImage(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;
  if (requested.has(url)) return;
  requested.add(url);

  const img = new window.Image();
  // Decoding off the main thread, and never fetched ahead of the visible
  // picture. `fetchPriority` is not in every lib.dom yet.
  (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
  img.decoding = "async";
  img.src = url;
}

/** Marks a url as already in flight, so a later preload does not repeat it. */
export function noteImageRequested(url: string | null | undefined): void {
  if (url) requested.add(url);
}

/** Test seam - forgets everything this page view has requested. */
export function resetImagePreloads(): void {
  requested.clear();
}
