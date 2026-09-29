"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { getProducts } from "@/lib/db";
import { parseVariants, getVariantImages, ProductVariant } from "@/lib/variants";
import { ProductImageCarousel, collectVariantPictures } from "@/components/product-image-carousel";
import { StarRating } from "@/components/star-rating";
import Link from "next/link";

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;
  const [product, setProduct] = useState<any>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const { addItem, items, totalItems } = useCart();

  useEffect(() => {
    if (!productId) return;
    
    const loadProduct = async () => {
      try {
        setLoading(true);
        const loadedProducts = await getProducts();
        setAllProducts(loadedProducts || []);
        
        const foundProduct = loadedProducts.find(
          (p: any) => p.id === productId || String(p.id) === productId,
        );
        
        if (foundProduct) {
          setProduct(foundProduct);
          // No design is selected on load: the page opens on the product's own
          // photo, and a design's name/description only appears once the
          // customer actually clicks that design.
          setSelectedVariant(null);
        } else {
          const byName = loadedProducts.find(
            (p: any) => p.name?.toLowerCase().includes(productId.toLowerCase())
          );
          if (byName) {
            setProduct(byName);
            setSelectedVariant(null);
          } else {
            setProduct({ error: "Product not found" });
          }
        }
      } catch (error) {
        console.error("Failed to load product:", error);
        setProduct({ error: "Product not found" });
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-foreground text-lg">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product || product.error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-foreground text-xl font-bold mb-4">
            Product Not Found
          </h1>
          <p className="text-muted-foreground mb-6">
            The product you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link href="/" className="text-accent hover:text-accent/80">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const baseStock =
    product.stock === null || product.stock === undefined || product.stock === ""
      ? null
      : Number(product.stock) || 0;

  const parsedVariants: ProductVariant[] = parseVariants(product.variants, baseStock ?? 0);
  const hasVariants = parsedVariants.length > 0;

  // The design the customer actually clicked. Stays null until they click one,
  // which is what keeps the design name/description hidden until then.
  const activeVariantObj = hasVariants
    ? parsedVariants.find((v) => v.name === selectedVariant) || null
    : null;

  // With no design picked we show the product's own (total) stock; once a design is
  // picked its own stock applies.
  const stockCount = hasVariants
    ? activeVariantObj
      ? activeVariantObj.stock
      : baseStock
    : baseStock;

  const isOutOfStock = stockCount !== null && stockCount <= 0;
  const isLowStock = stockCount !== null && stockCount > 0 && stockCount <= 5;

  const handleAddToCart = () => {
    if (isOutOfStock) {
      const nameWithVariant = selectedVariant ? `${product.name} (${selectedVariant})` : product.name;
      alert(`${nameWithVariant} is out of stock.`);
      return;
    }
    if (stockCount !== null) {
      const inCart = items.find(
        (i) => i.productId === product.id && (selectedVariant ? i.variant === selectedVariant : !i.variant)
      )?.quantity || 0;

      if (inCart + 1 > stockCount) {
        const nameWithVariant = selectedVariant ? `${product.name} (${selectedVariant})` : product.name;
        alert(`Only ${stockCount} of ${nameWithVariant} in stock.`);
        return;
      }
    }
    const cartImage = activeVariantObj?.image || product.image;
    addItem({
      productId: product.id,
      variant: selectedVariant || undefined,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: cartImage,
      ...(stockCount !== null ? { stock: stockCount } : {}),
    });
  };

  const images = product.images?.length > 0 
    ? product.images 
    : [product.image].filter(Boolean) 
    || ['/placeholder.jpg'];

  // The main gallery shows ONLY the product's own photos - a design's picture is
  // never mixed into it. Designs live in their own "Choose Your Design" section
  // below, and clicking one only swaps the big picture (see selectDesign).
  const productPhotos: string[] = images;

  // The pictures the main area is currently browsing: the selected design's own
  // pictures (up to 3) when one is picked, otherwise the product's own photos.
  // Arrows/dots move through THIS list, so browsing a design's second picture
  // never sends the customer back to the main product.
  const activeImages: string[] = activeVariantObj
    ? getVariantImages(activeVariantObj)
    : productPhotos;

  const safeImageIndex =
    currentImageIndex >= 0 && currentImageIndex < activeImages.length ? currentImageIndex : 0;

  const displayedImage = activeImages[safeImageIndex] || '/placeholder.jpg';

  // Clicking a design selects it and shows its first picture. Clicking the same
  // design again clears the selection, so the page goes back to the product.
  const selectDesign = (variant: ProductVariant) => {
    setCurrentImageIndex(0);
    setSelectedVariant((current) => (current === variant.name ? null : variant.name));
  };

  // Going back to the original product resets the picture to the first photo.
  const clearDesign = () => {
    setSelectedVariant(null);
    setCurrentImageIndex(0);
  };

  // Adds one specific design/variant to the cart (used by the design cards), so a
  // customer can fill the cart with several different designs from the same keychain.
  // The cart line always carries the design name + the design's own picture, so
  // nothing gets mixed up at checkout or in the orders dashboard.
  const addVariantToCart = (variant: ProductVariant) => {
    if (variant.stock <= 0) {
      alert(`${product.name} (${variant.name}) is out of stock.`);
      return;
    }
    selectDesign(variant);
    const inCart =
      items.find(
        (i) => i.productId === product.id && (i.variant || '') === variant.name
      )?.quantity || 0;

    if (inCart + 1 > variant.stock) {
      alert(`Only ${variant.stock} of ${product.name} (${variant.name}) in stock.`);
      return;
    }

    addItem({
      productId: product.id,
      variant: variant.name,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: variant.image || product.image,
      stock: variant.stock,
    });
  };

  // Arrows/dots only move through the pictures currently on show (the selected
  // design's own pictures, or the product's photos). They NEVER clear the design -
  // only the "Back to ..." button does that.
  const goToPreviousImage = () => {
    setCurrentImageIndex(
      safeImageIndex <= 0 ? Math.max(activeImages.length - 1, 0) : safeImageIndex - 1
    );
  };

  const goToNextImage = () => {
    setCurrentImageIndex(
      safeImageIndex >= activeImages.length - 1 ? 0 : safeImageIndex + 1
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 text-accent hover:text-accent/80">
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <Image
              src="/heroix-logo.png"
              alt="HEROIX"
              width={80}
              height={40}
              className="h-8 w-auto"
            />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/checkout" className="relative">
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

      {/* Product Hero Section */}
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

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Product Images */}
            <div className="space-y-6">
              <div className="relative h-96 bg-card/50 overflow-hidden group flex items-center justify-center">
                <img
                  src={displayedImage}
                  alt={activeVariantObj ? `${product.name} - ${activeVariantObj.name}` : product.name}
                  className="w-full h-full object-contain transition-all duration-300"
                />

                {/* This badge ties the displayed picture to its design. It only shows
                    up after the customer has actually clicked that design. */}
                {activeVariantObj && (
                  <div className="absolute top-3 left-3 bg-accent text-accent-foreground text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg max-w-[70%]">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{activeVariantObj.name}</span>
                    <button
                      type="button"
                      onClick={clearDesign}
                      title="Back to the main product picture"
                      aria-label="Back to the main product picture"
                      className="shrink-0 opacity-80 hover:opacity-100"
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                {/* Left Arrow */}
                {activeImages.length > 1 && (
                  <button
                    onClick={goToPreviousImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}
                
                {/* Right Arrow */}
                {activeImages.length > 1 && (
                  <button
                    onClick={goToNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Counter - shows which picture is on screen. With a design picked it
                  also shows that design's name; this only happens after a click. */}
              <div className="text-center">
                <div className="bg-black/50 text-white text-xs px-3 py-1 rounded inline-block">
                  {activeVariantObj
                    ? `${activeVariantObj.name} • ${safeImageIndex + 1}/${activeImages.length}`
                    : `${safeImageIndex + 1}/${productPhotos.length}`}
                </div>
              </div>

              {/* Dots for the pictures currently on show: the design's own pictures
                  when one is picked, otherwise the product's photos. Browsing these
                  never changes the selection. */}
              {activeImages.length > 1 && (
                <div className="flex justify-center gap-2 flex-wrap">
                  {activeImages.map((_: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      title={`Picture ${index + 1}`}
                      aria-label={`Picture ${index + 1}`}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === safeImageIndex
                          ? 'bg-accent w-4'
                          : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Selected design summary — only appears once a design is clicked.
                  This sits right under the big picture, so the title + description of a
                  design show up in the main area only AFTER the customer clicks it. */}
              {activeVariantObj && (
                <div className="flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
                  {activeVariantObj.image && (
                    <img
                      src={activeVariantObj.image}
                      alt={activeVariantObj.name}
                      className="w-16 h-16 rounded-lg object-cover border border-accent/30 flex-shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Selected design
                    </p>
                    <p className="text-base font-bold text-foreground leading-snug">
                      {activeVariantObj.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activeVariantObj.stock > 0
                        ? `${activeVariantObj.stock} in stock`
                        : "Out of stock"}{" "}
                      • Rs {product.price}
                    </p>
                    {activeVariantObj.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 whitespace-pre-line">
                        {activeVariantObj.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right side - Product Details. When a design is picked, the title and
                description switch to THAT design (the main product's are replaced,
                not shown alongside), with a button to go back to the original. */}
            <div className="space-y-6">
              <div className="space-y-3 animate-in fade-in slide-in-from-left duration-700">
                {activeVariantObj && (
                  <button
                    type="button"
                    onClick={clearDesign}
                    className="inline-flex items-center gap-2 text-sm font-bold text-accent-foreground bg-accent hover:bg-accent/90 shadow-md shadow-accent/25 rounded-lg px-4 py-2.5 transition-colors"
                    title={`Go back to ${product.name}`}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back to main design
                  </button>
                )}
                <h1 className="text-5xl md:text-7xl font-black text-foreground text-balance leading-tight">
                  {activeVariantObj ? activeVariantObj.name : product.name}
                </h1>
                <p className="text-xl text-muted-foreground text-balance whitespace-pre-line">
                  {activeVariantObj
                    ? activeVariantObj.description || product.description
                    : product.description}
                </p>
                {activeVariantObj && (
                  <p className="text-xs text-muted-foreground">
                    Showing one design of{" "}
                    <span className="text-foreground font-medium">{product.name}</span>
                  </p>
                )}
              </div>

              {/* A short line reminding where the designs are picked - the chips that
                  used to sit here duplicated the "Choose Your Design" cards. */}
              {hasVariants && (
                <p className="text-sm text-muted-foreground -mt-3">
                  {activeVariantObj
                    ? "Showing the selected design above."
                    : "Pick a design below to see its own picture, title and description."}
                </p>
              )}

              {/* The old "Select Design / Variant" chip picker was removed here: it
                  duplicated the "Choose Your Design" cards. Designs are picked there,
                  and the title/description above swap to the picked design. */}

              <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-left duration-700 delay-200">
                <div className="flex items-center gap-2">
                  <StarRating rating={product.rating} reviews={product.reviews} />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="text-2xl font-bold text-accent">
                    Rs {product.price}
                  </p>
                  {stockCount !== null && (
                    <span
                      className={`text-sm font-semibold ${
                        isOutOfStock
                          ? "text-red-400"
                          : isLowStock
                            ? "text-yellow-400"
                            : "text-green-400"
                      }`}
                    >
                      {isOutOfStock
                        ? "Out of Stock"
                        : isLowStock
                          ? `Only ${stockCount} left!`
                          : `In Stock (${stockCount})`}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-left duration-700 delay-300">
                <Button
                  size="lg"
                  disabled={isOutOfStock}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-accent text-accent hover:bg-accent/10"
                  onClick={() => router.push("/")}
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          </div>

          {/* Designs / Variants chooser - its OWN full-width section below the product,
              so a design's picture never sits inside the main product image area.
              Clicking a card shows its picture, title and description in the main area. */}
          {hasVariants && (
            <div className="mt-12 pt-8 border-t border-border space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  Choose Your Design
                </h3>
                <span className="text-xs text-muted-foreground">
                  {parsedVariants.length} design{parsedVariants.length > 1 ? "s" : ""} available
                  {" • "}same price Rs {product.price}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tap a design to see its big picture, title and description in the main
                area, then press its Add to Cart — every design is added separately and
                keeps its own name, picture, stock and price, so nothing gets mixed up in
                the cart or in your order.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {parsedVariants.map((variant, variantIdx) => {
                  const isSelected = selectedVariant === variant.name;
                  const isVariantOut = variant.stock <= 0;
                  // All of this design's own pictures, not just the first one - the
                  // customer used to only ever see a single picture per design.
                  const variantPictures = getVariantImages(variant);
                  const cardImage = variantPictures[0] || images[0];
                  return (
                    <div
                      key={`${variant.name}-${variantIdx}`}
                      className={`rounded-2xl border-2 bg-card/50 overflow-hidden flex flex-col transition-all ${
                        isSelected
                          ? "border-accent ring-2 ring-accent/30 shadow-lg shadow-accent/10"
                          : "border-border hover:border-accent/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectDesign(variant)}
                        className="relative block text-left w-full"
                        title={`Show ${variant.name}`}
                      >
                        <div className="relative w-full aspect-square bg-card/60">
                          {cardImage ? (
                            <img
                              src={cardImage}
                              alt={variant.name}
                              className={`w-full h-full object-cover ${
                                isVariantOut ? "opacity-50 grayscale" : ""
                              }`}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-accent/40">
                              {variant.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {variantPictures.length > 1 && (
                            <span
                              className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/70 text-white font-semibold shadow"
                              title={`This design has ${variantPictures.length} pictures`}
                            >
                              {variantPictures.length} photos
                            </span>
                          )}
                          {isSelected && (
                            <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-semibold shadow">
                              Viewing
                            </span>
                          )}
                          <span
                            className={`absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-semibold shadow ${
                              isVariantOut
                                ? "bg-red-500/90 text-white"
                                : variant.stock <= 5
                                  ? "bg-yellow-400/95 text-black"
                                  : "bg-green-500/90 text-black"
                            }`}
                          >
                            {isVariantOut ? "Out of stock" : `${variant.stock} left`}
                          </span>
                        </div>
                      </button>
                      <div className="p-3 flex flex-col gap-2 flex-1">
                        <p className="text-sm font-semibold text-foreground leading-snug">
                          {variant.name}
                        </p>
                        {/* Every picture of this design, right on the card. Clicking one
                            opens that design on that exact picture in the big view, so
                            a design with several photos is fully viewable instead of
                            only ever showing the first one. */}
                        {variantPictures.length > 1 && (
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {variantPictures.map((pic, picIdx) => {
                              const picActive = isSelected && safeImageIndex === picIdx;
                              return (
                                <button
                                  key={`${pic}-${picIdx}`}
                                  type="button"
                                  title={`${variant.name} - picture ${picIdx + 1} of ${variantPictures.length}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedVariant(variant.name);
                                    setCurrentImageIndex(picIdx);
                                  }}
                                  className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                                    picActive
                                      ? "border-accent ring-1 ring-accent/40"
                                      : "border-border hover:border-accent/60"
                                  } ${isVariantOut ? "opacity-50 grayscale" : ""}`}
                                >
                                  <img
                                    src={pic}
                                    alt={`${variant.name} picture ${picIdx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {/* The description is intentionally NOT printed here - it appears
                            in the main area only after the customer clicks this design. */}
                        <p className="text-sm font-bold text-accent mt-auto">
                          Rs {product.price}
                        </p>
                        <button
                          type="button"
                          disabled={isVariantOut}
                          onClick={() => addVariantToCart(variant)}
                          title={isVariantOut ? "Out of stock" : `Add ${variant.name} to cart`}
                          className={`w-full text-xs font-bold py-2 rounded-lg transition-colors ${
                            isVariantOut
                              ? "bg-muted text-muted-foreground cursor-not-allowed"
                              : "bg-accent text-accent-foreground hover:bg-accent/90"
                          }`}
                        >
                          {isVariantOut ? "Out of Stock" : "Add to Cart"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Product Details */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Product Details
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-4">
              Product Features
            </h3>
            {product.features?.length > 0 ? (
              <ul className="space-y-2 text-muted-foreground">
                {product.features.map((feature: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-accent rounded-full mt-1"></div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Check the description above for full product details, or ask us
                on WhatsApp (0314-3131716).
              </p>
            )}
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-4">
              Shipping &amp; Payment Info
            </h3>
            <div className="space-y-2 text-muted-foreground">
              <p>Fast shipping: Rs 280 nationwide (delivery charge)</p>
              <p>Delivery within 5-7 business days</p>
              <p>💳 Payment: NayaPay only — Account Number: 03084824939 (Account Name: Khawaja Aman Ali)</p>
              <p className="text-foreground">
                ⚠️ Your order is NOT confirmed without payment. After you order, we contact you on
                WhatsApp <a
                  href="https://wa.me/923143131716"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:text-accent/80"
                >
                  +92 314 3131716
                </a>{" "}
                — once your NayaPay payment is received, your order is confirmed and moves forward.
              </p>
            </div>
          </div>
        </div>

        {/* The design gallery above already lists every variant with its own picture,
            description, stock and Add to Cart button - kept out of here to avoid
            showing the same three variant lists on one page. */}
      </section>

      {/* Related Products */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Related Products
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {allProducts
            .filter(
              (p: any) =>
                p.id !== product.id && p.category === product.category,
            )
            .slice(0, 6)
            .map((relatedProduct: any) => {
              // Same as the home page grid: the card cycles the product's photos AND
              // every picture of every one of its designs.
              const relatedDesigns = parseVariants(
                relatedProduct.variants,
                Number(relatedProduct.stock) || 0
              );
              const relatedDesignPictures = collectVariantPictures(relatedDesigns);
              const relatedStock =
                relatedProduct.stock === null ||
                relatedProduct.stock === undefined ||
                relatedProduct.stock === ""
                  ? null
                  : Number(relatedProduct.stock) || 0;
              const relatedOut = relatedStock === 0;
              return (
              <Card
                key={relatedProduct.id}
                className="group border-border hover:border-accent transition-all duration-300 overflow-hidden cursor-pointer"
                onClick={() => router.push(`/products/${relatedProduct.id}`)}
              >
                <ProductImageCarousel
                  images={relatedProduct.image_urls || relatedProduct.images}
                  productImage={relatedProduct.image}
                  productName={relatedProduct.name}
                  variantImages={relatedDesignPictures}
                />

                {/* Design thumbnails, exactly like the home page grid */}
                {relatedDesigns.some((v) => getVariantImages(v).length > 0) && (
                  <div className="px-4 pt-3 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Designs (
                      {relatedDesigns.filter((v) => getVariantImages(v).length > 0).length})
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-0.5">
                      {relatedDesignPictures.map((pic, picIdx) => {
                        return (
                          <button
                            key={`${pic.designIndex}-${pic.pictureIndex}-${picIdx}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/products/${relatedProduct.id}`);
                            }}
                            className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-border hover:border-accent transition-colors"
                            title={`${pic.name}${pic.pictureCount > 1 ? ` (picture ${pic.pictureIndex} of ${pic.pictureCount})` : ""}${pic.stock <= 0 ? " (Out of stock)" : ` - ${pic.stock} left`}`}
                          >
                            <img
                              src={pic.image}
                              alt={pic.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-4">
                  <h3 className="font-bold text-lg text-foreground group-hover:text-accent transition-colors">
                    {relatedProduct.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {relatedProduct.description}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div>
                      <p className="text-2xl font-bold text-accent">
                        Rs {relatedProduct.price}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          relatedOut
                            ? "text-red-400"
                            : relatedDesigns.length > 0
                              ? "text-muted-foreground"
                              : "text-green-400"
                        }`}
                      >
                        {relatedOut
                          ? "Out of Stock"
                          : relatedDesigns.length > 0
                            ? `${relatedDesigns.length} designs available`
                            : "In Stock"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={relatedOut}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/products/${relatedProduct.id}`);
                      }}
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
            })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/30 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <Image
                src="/heroix-logo.png"
                alt="HEROIX"
                width={100}
                height={50}
                className="h-6 w-auto mb-4"
              />
              <p className="text-sm text-muted-foreground">
                Premium anime keychains for true collectors.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-4">Shop</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-accent transition-colors">
                    All Products
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">
                    New Arrivals
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">
                    Best Sellers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-accent transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">
                    Shipping Info
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-accent transition-colors">
                    Returns
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-4">Connect</h4>
              <div className="space-y-2 text-sm">
                <a
                  href="https://wa.me/923143131716"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-accent transition-colors block"
                >
                  WhatsApp
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-accent transition-colors block"
                >
                  Instagram
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2026 HEROIX. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
