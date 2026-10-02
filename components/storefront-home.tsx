// The interactive half of the home page.
//
// This is a CLIENT component, but the products are NOT fetched from here: the
// server component in app/page.tsx reads them and hands them over as
// `initialProducts`, so the product names, prices and links are already in the
// server-rendered HTML. The effect below is a background refresh only.
//
// It used to BE the page (app/page.tsx was "use client" and fetched the
// catalogue in useEffect). That meant the HTML Google received contained only
// "Featured Collection / Loading..." - no product names, no prices, and not one
// <a href> to a product page, because every card navigated with router.push()
// from an onClick handler.
"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MessageCircle,
  ShoppingCart,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { ChatModal } from "@/components/chat-modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
// Browser-safe catalogue read. This must NOT come from `@/lib/db`, which
// imports the server-only `lib/supabase-admin` and would throw on module
// evaluation in the browser, breaking hydration of the whole page.
import { getProducts } from "@/lib/catalogue";
import { parseVariants, getVariantImages, getVariantPrice } from "@/lib/variants";
import { ProductImageCarousel, collectVariantPictures } from "@/components/product-image-carousel";
import { StarRating } from "@/components/star-rating";
import { RotatingTagline } from "@/components/rotating-tagline";
import { ScrollReveal } from "@/components/scroll-reveal";
import { StoreFooter } from "@/components/store-footer";
import { getCategoryFilterOptions } from "@/lib/categories";
import { sortProducts, SORT_OPTIONS, DEFAULT_SORT, type SortKey } from "@/lib/sorting";
import { normalizeRating, normalizeReviewCount, DEFAULT_RATING } from "@/lib/reviews";

export function StorefrontHome({
  initialProducts = [],
}: {
  initialProducts?: any[];
}) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("All");
  // Default "Price: High to Low" so 500-600 Rs keychains sit above 400-500,
  // which sit above 300-350.
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT);
  const [chatOpen, setChatOpen] = useState(false);
  // Seeded from the server render, so the first paint already shows the products
  // and matches the server HTML exactly (no hydration mismatch).
  const [productList, setProductList] = useState<any[]>(initialProducts);
  const [loading, setLoading] = useState(initialProducts.length === 0);
  const { addItem, items, totalItems } = useCart();

  // Background refresh. The server render is cached (revalidate = 60s in
  // app/page.tsx), so stock and prices may be slightly behind by the time this
  // runs - but the grid must never flash back to "Loading..." for it, which is
  // why there is no setLoading(true) here.
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const savedProducts = await getProducts();
        if (savedProducts && savedProducts.length > 0) {
          setProductList(savedProducts);
        }
      } catch (error) {
        console.error("Failed to refresh products:", error);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();
  }, []);

  const filteredProducts =
    selectedCategory === "All"
      ? productList
      : productList.filter((p: any) => p.category === selectedCategory);

  // Ordering: most expensive band first by default. Each product is placed by
  // the cheapest price a customer can actually pay for it.
  const sortedProducts = useMemo(
    () => sortProducts(filteredProducts, sortKey),
    [filteredProducts, sortKey]
  );

  // "All" + every real category (Anime, Superhero, Marvel, DC, Sports, Gaming,
  // Others, plus anything else the admin has used) - so a product can never be
  // hidden behind a category that is missing from the filter bar.
  const categoryOptions = useMemo(
    () => getCategoryFilterOptions(productList.map((p: any) => p.category)),
    [productList]
  );

  // The store's average rating, weighted by how many reviews each product has.
  // Products that have no reviews of their own still count, using the store
  // default rating, so the hero always shows a proper score.
  const storeRating = useMemo(() => {
    let weighted = 0;
    let totalReviews = 0;
    for (const p of productList) {
      const reviews = normalizeReviewCount(p?.reviews, 1);
      const rating = normalizeRating(p?.rating);
      weighted += rating * reviews;
      totalReviews += reviews;
    }
    return totalReviews > 0 ? weighted / totalReviews : DEFAULT_RATING;
  }, [productList]);

  // The filter can point at a category that is no longer in the data (e.g. after
  // a rename) - fall back to showing everything rather than an empty page.
  useEffect(() => {
    if (selectedCategory !== "All" && !categoryOptions.includes(selectedCategory)) {
      setSelectedCategory("All");
    }
  }, [selectedCategory, categoryOptions]);

  // Tapping a card has to feel instant on a phone: the route is warmed while
  // the finger is still on its way down, and the product page reuses the
  // catalogue this grid already downloaded (see lib/catalogue.ts) instead of
  // showing a spinner for a second network round-trip.
  const prefetchProduct = (id: string) => {
    router.prefetch(`/products/${id}`);
  };

  const openProduct = (product: any) => {
    router.push(`/products/${product.id}`);
  };

  const handleAddToCart = (product: any) => {
    // If product has variants, direct to the product page so customer can pick their design & see stock
    const variants = parseVariants(product.variants, Number(product.stock) || 0);
    if (variants.length > 0) {
      router.push(`/products/${product.id}`);
      return;
    }

    const stock =
      product.stock === null || product.stock === undefined || product.stock === ""
        ? null
        : Number(product.stock) || 0;

    if (stock === 0) {
      alert(`${product.name} is out of stock.`);
      return;
    }

    if (stock !== null) {
      const inCart = items.find((i) => i.productId === product.id && !i.variant)?.quantity || 0;
      if (inCart + 1 > stock) {
        alert(`Only ${stock} of ${product.name} in stock.`);
        return;
      }
    }

    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
      ...(stock !== null ? { stock } : {}),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/heroix-logo.png"
              alt="HEROIX"
              width={80}
              height={40}
              className="h-8 w-auto transition-transform duration-300 hover:scale-105 touch:opacity-80"
            />
            {/* Was the flat "Premium Anime Keychains". Now it cycles the
                categories so the navbar says something worth reading. */}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">So much to order:</span>
              <RotatingTagline
                words={["Anime", "Marvel", "DC", "Gaming", "Sports"]}
                className="font-semibold text-accent"
              />
              <span className="text-muted-foreground">keychains</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/checkout"
              className="relative inline-flex rounded-full p-1 -m-1 transition-transform duration-200 hover:scale-110 active:scale-95 touch:bg-accent/10"
              aria-label="Your cart"
            >
              <ShoppingCart className="w-5 h-5 text-foreground" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section with Background Images */}
      <section className="relative overflow-hidden py-20 md:py-40">
        {/* Background Anime Layer */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/anime-bg.jpg"
            alt="Anime Background"
            fill
            className="object-cover opacity-30"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent"></div>
        </div>

        {/* Animated Motion Divs */}
        <div className="absolute top-10 right-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl animate-pulse z-0"></div>
        <div className="absolute bottom-20 left-10 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-pulse animation-delay-2000 z-0"></div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            {/* Left side - Content */}
            <div className="space-y-6">
              <div className="space-y-3 animate-in fade-in slide-in-from-left duration-700">
                <h1 className="text-5xl md:text-7xl font-black text-foreground text-balance leading-tight">
                  Unleash Your <span className="text-accent">Epic</span>{" "}
                  Collection
                </h1>
                <p className="text-xl text-muted-foreground text-balance">
                  Premium anime, superhero, Marvel, DC & sports keychains. Find
                  your perfect character with AI-powered recommendations.
                  Shipping Rs 280 nationwide!
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-left duration-700 delay-200">
                <Button
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base"
                  onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Shop Now
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-accent text-accent hover:bg-accent/10"
                  onClick={() => setChatOpen(true)}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Ask HEROIX AI
                </Button>
              </div>
              <div className="flex gap-8 pt-4 animate-in fade-in duration-700 delay-300">
                <div className="group cursor-pointer">
                  <p className="text-2xl font-bold text-accent group-hover:scale-110 transition-transform">
                    {categoryOptions.length > 1 ? categoryOptions.length - 1 : 0}+
                  </p>
                  <p className="text-sm text-muted-foreground">Categories</p>
                </div>
                {/* The average is computed from the catalogue and falls back to the
                    store's default rating. */}
                <div className="group cursor-pointer">
                  <p className="text-2xl font-bold text-accent group-hover:scale-110 transition-transform">
                    {storeRating.toFixed(1)}
                  </p>
                  <p className="text-sm text-muted-foreground">Customer Rating</p>
                </div>
                <div className="group cursor-pointer">
                  <p className="text-2xl font-bold text-accent group-hover:scale-110 transition-transform">
                    Rs 280
                  </p>
                  <p className="text-sm text-muted-foreground">Fast Shipping</p>
                </div>
              </div>
            </div>

            {/* Right side - Superhero Background */}
            <div className="relative h-96 md:h-[500px] animate-in fade-in slide-in-from-right duration-700">
              <Image
                src="/superhero-bg.jpg"
                alt="Superhero Background"
                fill
                className="object-cover rounded-3xl shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent rounded-3xl"></div>
              {/* Floating Card Effect */}
              <div className="absolute -bottom-6 -right-6 bg-card border border-border rounded-2xl p-4 shadow-xl">
                <p className="text-sm font-bold text-accent">Best Sellers</p>
                <p className="text-xs text-muted-foreground">Anime & Marvel</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <ScrollReveal>
        <section className="border-b border-border bg-card/30 py-6">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 ${
                    selectedCategory === category
                      ? "bg-accent text-accent-foreground"
                      : "bg-card text-foreground hover:bg-card/80 touch:bg-accent/10"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Products Grid. Only the heading animates in: the grid itself is never
          wrapped in ScrollReveal, because hiding the products behind an
          animation is how a shop ends up looking empty. */}
      <section id="products" className="max-w-7xl mx-auto px-4 py-16">
        <ScrollReveal>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">
              Featured Collection
            </h2>
            <p className="text-muted-foreground">
              {sortedProducts.length === 0 && loading
                ? "Loading..."
                : `${sortedProducts.length} designs in ${selectedCategory === "All" ? "all categories" : selectedCategory}`}
            </p>
          </div>

          {/* Ordering control. Defaults to Price: High to Low, so the priciest
              band of keychains is listed first. */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="sort-keychains"
              className="text-sm text-muted-foreground whitespace-nowrap"
            >
              Sort by
            </label>
            <select
              id="sort-keychains"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground text-sm focus:outline-none focus:border-accent"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          </div>
        </ScrollReveal>

        {/* Products decide what is shown, NOT the loading flag.
            This used to ask `loading` first, so any moment the flag was true the
            whole grid was replaced by a spinner - even with 70 keychains already
            rendered from the server. On a slow phone connection that reads as
            "the products disappeared". The flag may now only take over when there
            is genuinely nothing to show yet. */}
        {sortedProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProducts.map((product: any) => {
            const parsedVariants = parseVariants(product.variants, Number(product.stock) || 0);
            const hasVariants = parsedVariants.length > 0;
            const stockValue =
              product.stock === null || product.stock === undefined || product.stock === ""
                ? null
                : Number(product.stock) || 0;
            const isOutOfStock = stockValue === 0;
            const isLowStock = stockValue !== null && stockValue > 0 && stockValue <= 5;
            // Designs can each have their own price, so the card shows the
            // cheapest one as "from" when they differ, otherwise the single price.
            const designPrices = parsedVariants
              .map((v: any) => getVariantPrice(v, product.price))
              .filter((p: number) => p > 0);
            const designPriceLabel =
              designPrices.length === 0
                ? `Rs ${product.price}`
                : Math.min(...designPrices) === Math.max(...designPrices)
                  ? `Rs ${Math.min(...designPrices)}`
                  : `Rs ${Math.min(...designPrices)} - ${Math.max(...designPrices)}`;
            return (
            <Card
              key={product.id}
              // `hover:` never renders on a phone, so the "this is tappable"
              // cue is kept permanently there through `touch:`. `active:`
              // confirms the press instantly, and `touch-manipulation` stops
              // the browser holding a tap back to see whether it is a
              // double-tap-zoom (that wait is what made taps feel dead).
              className="group border-border hover:border-accent hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/10 touch:border-accent touch:shadow-lg touch:shadow-accent/5 transition-all duration-300 overflow-hidden cursor-pointer touch-manipulation select-none active:border-accent active:scale-[0.98] active:duration-75"
              onClick={() => openProduct(product)}
              onPointerEnter={() => prefetchProduct(product.id)}
              onPointerDown={() => prefetchProduct(product.id)}
            >
              {/* Product Image Carousel - cycles the product's photos AND all of its
                  design pictures, so every design is visible right in the grid. */}
              <ProductImageCarousel
                images={product.image_urls || product.images}
                productImage={product.image}
                productName={product.name}
                variantImages={collectVariantPictures(parsedVariants)}
              />

              {/* Design Sub-Pictures Strip - one thumbnail per design picture */}
              {parsedVariants.some((v) => getVariantImages(v).length > 0) && (
                <div className="px-4 pt-3 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Designs ({parsedVariants.filter((v) => getVariantImages(v).length > 0).length})
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-0.5">
                    {collectVariantPictures(parsedVariants).map((pic, picIdx) => {
                      return (
                        <button
                          key={`${pic.designIndex}-${pic.pictureIndex}-${picIdx}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/products/${product.id}`);
                          }}
                          className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
                          title={`${pic.name}${pic.pictureCount > 1 ? ` (picture ${pic.pictureIndex} of ${pic.pictureCount})` : ""}${pic.stock <= 0 ? " (Out of stock)" : ` - ${pic.stock} left`}`}
                        >
                          <img
                            src={pic.image}
                            alt={pic.name}
                            draggable={false}
                            className="w-full h-full object-cover select-none [-webkit-user-drag:none]"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Product Info */}
              <div className="p-4 space-y-4">
                <div>
                  {/* A real href link, not just an onClick. This is the only thing
                      a crawler can follow from the grid, and it also buys keyboard
                      focus and "open in new tab" for free. The whole card still
                      navigates on tap through the onClick on the Card itself. */}
                  <h3 className="font-bold text-lg text-foreground group-hover:text-accent touch:text-accent transition-colors">
                    <Link
                      href={`/products/${product.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="focus-visible:underline"
                    >
                      {product.name}
                    </Link>
                  </h3>
                </div>

                {/* Rating - shows empty stars and "No reviews yet" for a product that
                    has no reviews yet, instead of a misleading "4.5 (0)". */}
                <StarRating rating={product.rating} reviews={product.reviews} />

                {/* Price and Action */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <p className="text-2xl font-bold text-accent">
                      {designPriceLabel}
                    </p>
                    <p
                      className={`text-xs font-semibold ${
                        isOutOfStock
                          ? "text-red-400"
                          : isLowStock
                            ? "text-yellow-400"
                            : "text-green-400"
                      }`}
                    >
                      {isOutOfStock
                        ? "Out of Stock"
                        : hasVariants
                          ? `${parsedVariants.length} designs available`
                          : isLowStock
                            ? `Only ${stockValue} left!`
                            : "In Stock"}
                    </p>
                    {/* A phone never hovers, so say what a tap does. Hidden on
                        pointer devices, where the hover highlight already
                        makes it obvious. */}
                    <p className="hidden touch:inline-flex items-center gap-0.5 mt-1 text-xs font-semibold text-accent">
                      View details
                      <ChevronRight className="w-3 h-3" />
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={isOutOfStock}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                    className="bg-accent hover:bg-accent/90 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95 transition-all text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    title={
                      isOutOfStock
                        ? "Out of stock"
                        : hasVariants
                          ? "Choose design"
                          : "Add to cart"
                    }
                  >
                    {hasVariants ? (
                      <span className="text-xs font-bold px-1">Options</span>
                    ) : (
                      <ShoppingCart className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>
            );
          })}
        </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground">
              {selectedCategory === "All"
                ? "No products found. Please try again later."
                : `No ${selectedCategory} keychains right now.`}
            </p>
          </div>
        )}
      </section>
      <StoreFooter />

      {/* Floating Chat Button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg flex items-center justify-center transition-all duration-300 z-50 hover:scale-110"
        aria-label="Chat with HEROIX AI"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Modal */}
      <ChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
