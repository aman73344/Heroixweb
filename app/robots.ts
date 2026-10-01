import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Lets Google index the store and its products.
//
// The admin area, the private store-owner gate and the API routes are all
// explicitly disallowed. /admin is already protected by a session check and
// /heroix-gate sends noindex in its own metadata, but a crawler should never
// spend its budget on them at all - especially not on /api/*, which can produce
// duplicate-looking URLs.
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/heroix-gate", "/api/", "/checkout"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}