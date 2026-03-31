"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Star,
  MessageCircle,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { ChatModal } from "@/components/chat-modal";
import Link from "next/link";
import { getProducts } from "@/lib/db";

const defaultCategories = ['All', 'Anime', 'Superhero', 'Marvel', 'DC', 'Sports'];

// Product Image Carousel Component
function ProductImageCarousel({
  images,
  productName,
  productImage,
}: {
  images?: string[];
  productName: string;
  productImage?: string;
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Support both images array and single image
  let imageList: string[] = [];
  if (images && images.length > 0) {
    imageList = images;
  } else if (productImage) {
    imageList = [productImage];
  }
  
  const hasMultipleImages = imageList.length > 1;
  const displayImage = imageList[currentImageIndex] || null;

  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) =>
      prev === 0 ? imageList.length - 1 : prev - 1,
    );
  };

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) =>
      prev === imageList.length - 1 ? 0 : prev + 1,
    );
  };

  return (
    <div className="relative h-48 bg-card/50 overflow-hidden group flex items-center justify-center">
      {displayImage ? (
        <>
          {/* Current Image - Responsive without cropping */}
          <img
            src={displayImage}
            alt={productName}
            className="w-full h-full object-contain"
            onError={(e) => {
              // Fallback if image fails to load
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
            }}
          />
          {/* Fallback icon when image not loaded */}
          <div className="absolute inset-0 flex items-center justify-center text-6xl font-black text-accent/30 hidden">
            ★
          </div>

          {/* Image Counter */}
          {hasMultipleImages && (
            <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              {currentImageIndex + 1}/{imageList.length}
            </div>
          )}

          {/* Navigation Arrows - Only show if multiple images */}
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

              {/* Image Dots */}
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
          ★
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [chatOpen, setChatOpen] = useState(false);
  const [productList, setProductList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem, totalItems } = useCart();

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const savedProducts = await getProducts();
        if (savedProducts && savedProducts.length > 0) {
          setProductList(savedProducts);
        }
      } catch (error) {
        console.error("Failed to load products:", error);
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

  const handleAddToCart = (product: any) => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
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
              className="h-8 w-auto"
            />
            <span className="text-foreground text-sm font-semibold hidden sm:inline">
              Premium Anime Keychains
            </span>
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
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-foreground">
                Admin
              </Button>
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
                  Shipping Rs 250 nationwide!
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
                    18+
                  </p>
                  <p className="text-sm text-muted-foreground">Categories</p>
                </div>
                <div className="group cursor-pointer">
                  <p className="text-2xl font-bold text-accent group-hover:scale-110 transition-transform">
                    4.8★
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Customer Rating
                  </p>
                </div>
                <div className="group cursor-pointer">
                  <p className="text-2xl font-bold text-accent group-hover:scale-110 transition-transform">
                    Rs 250
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
      <section className="border-b border-border bg-card/30 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {defaultCategories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category
                    ? "bg-accent text-accent-foreground"
                    : "bg-card text-foreground hover:bg-card/80"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section id="products" className="max-w-7xl mx-auto px-4 py-16">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Featured Collection
          </h2>
          <p className="text-muted-foreground">
            {loading ? "Loading..." : `${filteredProducts.length} designs in ${selectedCategory === "All" ? "all categories" : selectedCategory}`}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No products found. Please try again later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product: any) => (
            <Card
              key={product.id}
              className="group border-border hover:border-accent transition-all duration-300 overflow-hidden cursor-pointer"
              onClick={() => window.location.href = `/products/${product.id}`}
            >
              {/* Product Image Carousel */}
              <ProductImageCarousel
                images={product.images}
                productImage={product.image}
                productName={product.name}
              />

              {/* Product Info */}
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="font-bold text-lg text-foreground group-hover:text-accent transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {product.description}
                  </p>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(product.rating)
                            ? "fill-accent text-accent"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {product.rating} ({product.reviews})
                  </span>
                </div>

                {/* Price and Action */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <p className="text-2xl font-bold text-accent">
                    Rs {product.price}
                  </p>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
        )}
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
                  href="https://wa.me/1234567890"
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
