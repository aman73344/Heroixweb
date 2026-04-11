"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Star,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { getProducts } from "@/lib/db";
import Link from "next/link";

const defaultCategories = ['All', 'Anime', 'Superhero', 'Marvel', 'DC', 'Sports'];

export default function ProductPage() {
  const params = useParams();
  const productId = params?.id as string;
  const [product, setProduct] = useState<any>(null);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { addItem, totalItems } = useCart();

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
        } else {
          const byName = loadedProducts.find(
            (p: any) => p.name?.toLowerCase().includes(productId.toLowerCase())
          );
          if (byName) {
            setProduct(byName);
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
            The product you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/" className="text-accent hover:text-accent/80">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      image: product.image,
    });
  };

  const images = product.images?.length > 0 
    ? product.images 
    : [product.image].filter(Boolean) 
    || ['/placeholder.jpg'];

  const goToPreviousImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  const goToNextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === images.length - 1 ? 0 : prev + 1
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
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-foreground">
                Admin
              </Button>
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
                  src={images[currentImageIndex]}
                  alt={`${product.name} - Image ${currentImageIndex + 1}`}
                  className="w-full h-full object-contain"
                />
                
                {/* Left Arrow */}
                {images.length > 1 && (
                  <button
                    onClick={goToPreviousImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}
                
                {/* Right Arrow */}
                {images.length > 1 && (
                  <button
                    onClick={goToNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Image Counter */}
              <div className="text-center">
                <div className="bg-black/50 text-white text-xs px-3 py-1 rounded inline-block">
                  {currentImageIndex + 1}/{images.length}
                </div>
              </div>

              {/* Image Dots */}
              {images.length > 1 && (
                <div className="flex justify-center gap-2">
                  {images.map((_: string, index: number) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentImageIndex 
                          ? 'bg-accent w-4' 
                          : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right side - Product Details */}
            <div className="space-y-6">
              <div className="space-y-3 animate-in fade-in slide-in-from-left duration-700">
                <h1 className="text-5xl md:text-7xl font-black text-foreground text-balance leading-tight">
                  {product.name}
                </h1>
                <p className="text-xl text-muted-foreground text-balance">
                  {product.description}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-left duration-700 delay-200">
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
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-accent">
                    Rs {product.price}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-left duration-700 delay-300">
                <Button
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-base"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add to Cart
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-accent text-accent hover:bg-accent/10"
                  onClick={() => (window.location.href = "/")}
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          </div>
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
            <ul className="space-y-2 text-muted-foreground">
              {product.features?.map((feature: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-accent rounded-full mt-1"></div>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-4">
              Shipping Info
            </h3>
            <div className="space-y-2 text-muted-foreground">
              <p>Fast shipping: Rs 250 nationwide</p>
              <p>Delivery within 3-5 business days</p>
              <p>Free returns within 7 days</p>
            </div>
          </div>
        </div>
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
            .map((relatedProduct: any) => (
              <Card
                key={relatedProduct.id}
                className="group border-border hover:border-accent transition-all duration-300 overflow-hidden cursor-pointer"
                onClick={() =>
                  (window.location.href = `/products/${relatedProduct.id}`)
                }
              >
                <img
                  src={relatedProduct.image}
                  alt={relatedProduct.name}
                  className="w-full h-48 object-contain"
                />
                <div className="p-4 space-y-4">
                  <h3 className="font-bold text-lg text-foreground group-hover:text-accent transition-colors">
                    {relatedProduct.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {relatedProduct.description}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <p className="text-2xl font-bold text-accent">
                      Rs {relatedProduct.price}
                    </p>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart();
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
    </div>
  );
}
