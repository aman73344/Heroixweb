import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalogue";
import { getSiteUrl } from "@/lib/site-url";

// Lists every page Google should crawl: the store and each product.
//
// This is the other half of "the products must be reachable". The home page now
// renders real <a href="/products/..."> links, and this makes sure Google is also
// told about pages it has never seen - including products added after the last
// crawl, which nothing else would surface.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      changeFrequency: "daily",
      priority: 1,
    },
  ];

  // A database problem must not take the whole sitemap down; the static routes
  // are still useful on their own.
  let products: any[] = [];
  try {
    products = (await getProducts()) || [];
  } catch (error) {
    console.error("Sitemap: could not read products:", error);
  }

  const productRoutes: MetadataRoute.Sitemap = products
    .filter((product) => product?.id)
    .map((product) => ({
      url: `${base}/products/${product.id}`,
      // Prices, stock and descriptions change whenever the admin edits a
      // product, so Google is told to come back fairly often.
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...staticRoutes, ...productRoutes];
}