"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Edit2, Trash2, Plus, X, Upload, Loader2 } from "lucide-react";
import { getProducts } from "@/lib/db";
import { supabase } from "@/lib/supabase";

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
  const [productList, setProductList] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const savedProducts = await getProducts();
        if (savedProducts && savedProducts.length > 0) {
          setProductList(savedProducts);
        }
      } catch (error) {
        console.error("Failed to load products:", error);
        setProductList([]);
      }
    };
    loadProducts();
  }, []);

  const [form, setForm] = useState<ProductForm>({
    name: "",
    description: "",
    price: 0,
    category: "Anime",
    stock: 0,
    rating: 4.5,
    images: [],
  });

  const uploadImageToStorage = async (file: File, productId: string, index: number): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}/${Date.now()}-${index}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('products')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload failed:', error);
      return null;
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentImages = form.images.length;
    const remainingSlots = 5 - currentImages;
    
    if (remainingSlots <= 0) {
      alert('Maximum 5 images allowed');
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadProgress("Uploading images...");

    const tempProductId = editingProductId || `temp-${Date.now()}`;
    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file.');
          continue;
        }
        
        if (file.size > 2 * 1024 * 1024) {
          alert(`Image "${file.name}" is too large. Max 2MB allowed.`);
          continue;
        }

        setUploadProgress(`Uploading ${i + 1}/${filesToUpload.length}...`);

        const url = await uploadImageToStorage(file, tempProductId, i);
        if (url) {
          uploadedUrls.push(url);
        }
      }

      if (uploadedUrls.length > 0) {
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls],
        }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload some images. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }

    e.target.value = '';
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

  const handleAddProduct = async () => {
    if (!form.name || form.price === 0) {
      alert("Please fill required fields");
      return;
    }

    if (form.images.length === 0) {
      alert("Please add at least one product image");
      return;
    }

    const productId = editingProductId || `prod-${Date.now()}`;
    
    try {
      const productToSave = {
        id: productId,
        name: form.name,
        description: form.description,
        price: form.price,
        category: form.category,
        stock: form.stock,
        rating: form.rating,
        image: form.images[0],
        image_urls: form.images,
        reviews: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const response = await fetch("/api/admin-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", product: productToSave }),
      });

      const result = await response.json();

      if (!result.success) {
        alert("Error saving: " + (result.error || "Unknown error"));
        return;
      }

      const productData = {
        id: productId,
        name: form.name,
        description: form.description,
        price: form.price,
        category: form.category,
        stock: form.stock,
        rating: form.rating,
        image: form.images[0],
        images: form.images,
        inStock: form.stock > 0,
        reviews: 0,
      };

      if (editingProductId) {
        setProductList((prev) =>
          prev.map((p) =>
            p.id === editingProductId ? productData : p,
          ),
        );
      } else {
        setProductList((prev) => [...prev, productData]);
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
      setEditingProductId(null);

    } catch (error: any) {
      console.error("Error:", error);
    }
  };

  const handleEditProduct = (productId: string) => {
    const product = productList.find((p: any) => p.id === productId);
    if (product) {
      setEditingProductId(productId);
      
      const images = product.images?.length > 0 
        ? product.images 
        : [product.image].filter(Boolean) 
        || ['/placeholder.jpg'];
      
      setForm({
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        stock: product.stock ?? 1,
        rating: product.rating,
        images: images,
      });
      setShowAddForm(true);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      setProductList((prev) => prev.filter((p) => p.id !== productId));
      
      try {
        await fetch("/api/admin-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", product: { id: productId } }),
        });
      } catch (error) {
        console.error("Error deleting product:", error);
      }
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
                value={form.price || ''}
                onChange={(e) =>
                  setForm({ ...form, price: parseFloat(e.target.value) || 0 })
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
                value={form.stock || ''}
                onChange={(e) =>
                  setForm({ ...form, stock: parseInt(e.target.value) || 0 })
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
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading || form.images.length >= 5}
                  className="flex-1 px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent file:bg-accent file:text-accent-foreground file:border-0 file:rounded file:px-3 file:py-1 file:mr-2 disabled:opacity-50"
                />
                {isUploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadProgress}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Max 2MB per image. Images upload to cloud storage.
              </p>
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
        {filteredProducts.map((product: any) => {
          const images = product.images?.length > 0 
            ? product.images 
            : [product.image].filter(Boolean) 
            || ['/placeholder.jpg'];
          return (
          <Card key={product.id} className="border-border overflow-hidden">
            <div className="h-48 bg-card/50 border-b border-border overflow-x-auto">
              {images && images.length > 0 ? (
                <div className="flex gap-2 w-full h-full items-center justify-start">
                  {images.map((img: string, idx: number) => (
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
                    (product as any).stock > 0
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {(product as any).stock > 0 ? "In Stock" : "Out of Stock"}
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
          );
        })}
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
