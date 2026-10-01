import type { Metadata } from "next";
import { StorefrontHome } from "@/components/storefront-home";
import { getProducts } from "@/lib/catalogue";
import { getSiteUrl } from "@/lib/site-url";

// WHY THIS PAGE IS A SERVER COMPONENT
// It used to be "use client" and fetched the catalogue from useEffect, so the
// HTML a crawler received was only the shell: "Featured Collection" followed by
// "Loading...". No product names, no prices, and no links at all, because every
// card navigated through router.push() inside an onClick handler that only exists
// once JavaScript has run.
//
// The grid is now read here, on the server, and passed to the client component as
// `initialProducts`, so product names, prices and <a href="/products/..."> links
// are part of the delivered HTML.
//
// revalidate = 60 keeps stock and prices honest (an admin change shows up within a
// minute) without a database round-trip on every visitor. getProducts() never
// throws - it logs and returns [] - so a database problem degrades this page to
// the old client-side load instead of a 500.
export const revalidate = 60;

// Keyword-led title: "anime keychains" and "Pakistan" are what a shopper types.
// Kept close to 65 characters so Google does not truncate it.
const TITLE =
  "Anime Keychains in Pakistan | Marvel, DC & Gaming Keychains – HEROIX";

const DESCRIPTION =
  "Shop anime keychains in Pakistan at HEROIX. Premium Marvel, DC, superhero and gaming keychains hand-picked for collectors. Nationwide shipping Rs 280.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  // `absolute` on purpose: the root layout sets a "%s | HEROIX" template, and a
  // plain string here would come out as "... – HEROIX | HEROIX". This title is
  // already the complete, keyword-led one.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "anime keychains",
    "keychains in Pakistan",
    "Marvel keychains",
    "DC keychains",
    "gaming keychains",
    "superhero keychains",
    "anime merch Pakistan",
  ],
  openGraph: {
    type: "website",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "HEROIX",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function Home() {
  const products = await getProducts();
  return <StorefrontHome initialProducts={products} />;
}