"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { products } from "@/lib/products";
import { Edit2, Trash2, Plus, X } from "lucide-react";
import { getProducts, saveProducts } from "@/lib/db";

interface ProductForm {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  rating: number;
  images: string[];
}

export default function ProductsPage() {
  const [productList, setProductList] = useState(products);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  // Load products from IndexedDB on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const savedProducts = await getProducts();
        if (savedProducts && savedProducts.length > 0) {
          setProductList(savedProducts);
        }
      } catch (error) {
        console.error("Failed to load products from IndexedDB:", error);
        // Fallback to default products if IndexedDB fails
        setProductList(products);
      }
    };
    loadProducts();
  }, []);

  // Save products to IndexedDB whenever productList changes
  useEffect(() => {
    const saveToDB = async () => {
      try {
        await saveProducts(productList);
        // Also sync to server for chatbot context
        await syncProductsToServer(productList);
      } catch (error) {
        console.error("Failed to save products:", error);
      }
    };
    // Only save if productList is different from initial products
    if (productList !== products) {
      saveToDB();
    }
  }, [productList]);

  const syncProductsToServer = async (productsToSync: any[]) => {
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-all",
          products: productsToSync.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            price: p.price,
            stock: p.stock,
            description: p.description || "",
          })),
        }),
      });
      if (!response.ok) {
        console.error("Failed to sync products to server");
      }
    } catch (error) {
      console.error("Error syncing products to server:", error);
    }
  };
  const [form, setForm] = useState<ProductForm>({
    name: "",
    description: "",
    price: 0,
    category: "Anime",
    stock: 0,
    rating: 4.5,
    images: [],
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setForm((prev) => ({
            ...prev,
            images: [...prev.images, base64].slice(0, 5),
          }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const filteredProducts = productList.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleAddProduct = () => {
    if (!form.name || form.price === 0) {
      alert("Please fill required fields");
      return;
    }

    if (form.images.length === 0) {
      alert("Please add at least one product image");
      return;
    }

    if (editingProductId) {
      // Update existing product
      setProductList((prev) =>
        prev.map((p) =>
          p.id === editingProductId
            ? {
                ...p,
                ...form,
                image: form.images[0],
                inStock: form.stock > 0,
              }
            : p,
        ),
      );
      setEditingProductId(null);
    } else {
      // Add new product
      const newProduct = {
        id: `prod-${Date.now()}`,
        ...form,
        image: form.images[0],
        inStock: form.stock > 0,
        reviews: 0,
      };
      setProductList([...productList, newProduct]);
    }

    setForm({
      name: "",
      description: "",
      price: 0,
      category: "Anime",
      stock: 0,
      rating: 4.5,
      images: [],
    });
    setShowAddForm(false);
  };

  const handleEditProduct = (productId: string) => {
    const product = productList.find((p) => p.id === productId);
    if (product) {
      setEditingProductId(productId);
      setForm({
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        stock: product.stock,
        rating: product.rating,
        images: product.images || [product.image],
      });
      setShowAddForm(true);
    }
  };

  const handleDeleteProduct = (productId: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      setProductList((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground mt-2">
            Manage your keychain catalog
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingProductId(null);
            setForm({
              name: "",
              description: "",
              price: 0,
              category: "Anime",
              stock: 0,
              rating: 4.5,
              images: [],
            });
            setShowAddForm(!showAddForm);
          }}
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Search Bar */}
      <Input
        type="text"
        placeholder="Search products by name or category..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="bg-card/50 border-border"
      />

      {/* Add Product Form */}
      {showAddForm && (
        <Card className="p-6 border-border bg-card/50">
          <h2 className="text-xl font-bold text-foreground mb-4">
            {editingProductId ? "Edit Product" : "Add New Product"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-2">
                Name *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Attack on Titan"
                className="bg-background/50 border-border"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-2">
                Category *
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
              >
                <option value="Anime">Anime</option>
                <option value="Superhero">Superhero</option>
                <option value="Marvel">Marvel</option>
                <option value="DC">DC</option>
                <option value="Sports">Sports</option>
              </select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-2">
                Price (PKR) *
              </label>
              <Input
                type="number"
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: parseFloat(e.target.value) })
                }
                placeholder="599"
                className="bg-background/50 border-border"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-2">
                Stock
              </label>
              <Input
                type="number"
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: parseInt(e.target.value) })
                }
                placeholder="50"
                className="bg-background/50 border-border"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground block mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Product description..."
                rows={3}
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground block mb-2">
                Product Images * (Max 5)
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent file:bg-accent file:text-accent-foreground file:border-0 file:rounded file:px-3 file:py-1 file:mr-2"
              />
              {form.images.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Images ({form.images.length}/5)
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {form.images.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative group flex items-center justify-center bg-card/30 rounded border border-border p-2"
                      >
                        <img
                          src={img}
                          alt={`Product ${idx + 1}`}
                          className="w-full h-20 object-contain rounded"
                        />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-2 flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingProductId(null);
                  setForm({
                    name: "",
                    description: "",
                    price: 0,
                    category: "Anime",
                    stock: 0,
                    rating: 4.5,
                    images: [],
                  });
                }}
                className="border-border"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddProduct}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {editingProductId ? "Update Product" : "Add Product"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="border-border overflow-hidden">
            <div className="h-48 bg-card/50 border-b border-border overflow-x-auto">
              {product.images && product.images.length > 0 ? (
                <div className="flex gap-2 w-full h-full items-center justify-start">
                  {product.images.map((img, idx) => (
                    <div
                      key={idx}
                      className="h-48 flex-shrink-0 w-48 flex items-center justify-center bg-card/30 rounded p-2"
                    >
                      <img
                        src={img}
                        alt={`${product.name} ${idx + 1}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-4xl mb-2">📦</div>
                  <p className="text-xs text-muted-foreground">No image</p>
                </div>
              )}
            </div>
            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-bold text-foreground">{product.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {product.category}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-accent">
                  Rs {product.price}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    product.inStock
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {product.inStock ? "In Stock" : "Out of Stock"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>⭐ {product.rating}</span>
                <span>({product.reviews} reviews)</span>
              </div>
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-accent hover:bg-accent/10"
                  onClick={() => handleEditProduct(product.id)}
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-red-400 hover:bg-red-500/10"
                  onClick={() => handleDeleteProduct(product.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No products found</p>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            Add First Product
          </Button>
        </div>
      )}
    </div>
  );
}
