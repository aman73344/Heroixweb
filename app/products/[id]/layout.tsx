import type { Metadata } from "next";
import { getProducts } from "@/lib/catalogue";
import { getSiteUrl } from "@/lib/site-url";
import { imageUrl } from "@/lib/image-url";

// Per-product titles and descriptions for search engines.
//
// WHY A LAYOUT
// app/products/[id]/page.tsx has to be a client component - the gallery, the
// design picker and the cart all need state and useParams. A client component
// cannot export `metadata`, so without this file every single product page was
// titled "HEROIX - Premium Anime Keychains": identical titles across the whole
// catalogue, and Google had nothing to rank. A layout CAN be a server component
// while its page is a client component, which is exactly what is needed here.
//
// The title is now the product's own name, which is what a shopper searches for
// ("Attack on Titan keychain"). The `%s | HEROIX` template comes from the root
// layout.
export const revalidate = 60;

const FALLBACK_TITLE = "Keychain";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  // A failed lookup must never break the page itself - fall back to the generic
  // title and let the client component handle the "product not found" state.
  try {
    const products = (await getProducts()) || [];
    const product = products.find(
      (p: any) => p.id === id || String(p.id) === id,
    );

    if (!product) {
      return { title: FALLBACK_TITLE };
    }

    const name = String(product.name || "Keychain").trim();
    const category = product.category ? String(product.category) : null;
    const price = Number(product.price) || 0;

    // No "| HEROIX" here on purpose: the root layout's "%s | HEROIX" template
    // appends the brand to the <title>, and this exact string is reused for the
    // Open Graph title below, which does NOT go through the template.
    const title = category
      ? `${name} ${category} Keychain in Pakistan`
      : `${name} Keychain in Pakistan`;
    const brandedTitle = `${title} | HEROIX`;

    // Built from what is actually stored, so it can never drift from the product.
    const description =
      product.description ||
      `Buy the ${name} keychain at HEROIX${price ? ` for Rs ${price}` : ""}. Premium anime, Marvel, DC and gaming keychains with nationwide shipping Rs 280.`;

    const image =
      (Array.isArray(product.images) && product.images[0]) || product.image || null;

    // Social platforms fetch this url themselves, on every share, for every
    // crawler that indexes the catalogue. Asking for the 800px WebP derivative
    // instead of the 1080px original keeps the picture looking the same to the
    // crawler at a third of the bytes - this is Supabase egress that no shopper
    // ever benefits from.
    const shareImage = image ? imageUrl(image, 800) : null;

    return {
      title,
      description: String(description).slice(0, 300),
      alternates: { canonical: `/products/${product.id}` },
      openGraph: {
        type: "website",
        url: `${getSiteUrl()}/products/${product.id}`,
        title: brandedTitle,
        description: String(description).slice(0, 300),
        ...(shareImage ? { images: [{ url: shareImage }] } : {}),
      },
    };
  } catch (error) {
    console.error("generateMetadata: could not read product", id, error);
    return { title: FALLBACK_TITLE };
  }
}

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}