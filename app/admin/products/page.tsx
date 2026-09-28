"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { Edit2, Trash2, Plus, X, Upload, Loader2, ImageIcon } from "lucide-react";
import { getProducts } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { parseVariants, formatVariantsForStorage, formatVariantsForTextarea, calculateEffectiveStock, getVariantImages, normalizeVariantImages, MAX_VARIANT_IMAGES } from "@/lib/variants";

interface ProductForm {
  name: string;
  description: string;
  features: string;
  variants: string;
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
    features: "",
    variants: "",
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
      
      const { error } = await supabase.storage
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

  // Compress large photos in the browser before uploading so product pages
  // keep loading fast even when the admin uploads 10MB images.
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const COMPRESS_BELOW_BYTES = 500 * 1024;
  const MAX_IMAGE_DIMENSION = 1600;

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      if (file.size <= COMPRESS_BELOW_BYTES || !file.type.startsWith("image/")) {
        resolve(file);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          let { width, height } = img;
          if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
            const ratio = Math.min(
              MAX_IMAGE_DIMENSION / width,
              MAX_IMAGE_DIMENSION / height,
            );
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Keep PNG (preserves transparency), otherwise export as JPEG
          const outputType =
            file.type === "image/png" ? "image/png" : "image/jpeg";

          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) {
                resolve(file);
                return;
              }
              const extension = outputType === "image/png" ? "png" : "jpg";
              const baseName = file.name.replace(/\.[^.]+$/, "");
              resolve(
                new File([blob], `${baseName}.${extension}`, {
                  type: outputType,
                  lastModified: Date.now(),
                }),
              );
            },
            outputType,
            0.82,
          );
        } catch {
          resolve(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    });
  };

  // Uploads one or more product photos to Supabase. Shared by the file picker and
  // the drag & drop zone below, so dropping photos behaves exactly like picking
  // them from the file dialog.
  const uploadProductFiles = async (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    if (files.length === 0) return;

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
        
        if (file.size > MAX_IMAGE_BYTES) {
          alert(`Image "${file.name}" is too large. Max 10MB allowed.`);
          continue;
        }

        setUploadProgress(`Optimizing ${i + 1}/${filesToUpload.length}...`);
        const optimizedFile = await compressImage(file);

        setUploadProgress(`Uploading ${i + 1}/${filesToUpload.length}...`);

        const url = await uploadImageToStorage(optimizedFile, tempProductId, i);
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
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadProductFiles(files);
    e.target.value = '';
  };

  // Drag & drop support for the product photos zone.
  const [isDraggingProductImages, setIsDraggingProductImages] = useState(false);

  const handleProductImagesDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingProductImages(false);
    if (isUploading || form.images.length >= 5) return;

    const dropped = Array.from(e.dataTransfer?.files || []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (dropped.length === 0) {
      alert('Please drop an image file.');
      return;
    }

    await uploadProductFiles(dropped);
  };

  const [uploadingVariantIndex, setUploadingVariantIndex] = useState<number | null>(null);
  // Which design card currently has a picture dragged over it (dashed highlight).
  const [dragOverVariantIndex, setDragOverVariantIndex] = useState<number | null>(null);

  // Uploads pictures for one design. Up to MAX_VARIANT_IMAGES (3) per design -
  // extra pictures are appended, existing ones are kept. Shared by the file
  // picker, the "Change/Add" button and the drag & drop zone.
  const uploadVariantImageFile = async (file: File, variantIndex: number) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      alert(`Image "${file.name}" is too large. Max 10MB allowed.`);
      return;
    }

    setUploadingVariantIndex(variantIndex);
    try {
      const optimizedFile = await compressImage(file);
      const tempProductId = editingProductId || `temp-${Date.now()}`;
      // Slot 100+ keeps variant pictures separate from the product's own photos.
      const url = await uploadImageToStorage(optimizedFile, tempProductId, 100 + variantIndex);

      if (url) {
        // Add the picture to this design, keeping the ones already there.
        const parsed = parseVariants(form.variants, form.stock);
        if (parsed[variantIndex]) {
          parsed[variantIndex].images = normalizeVariantImages([
            ...getVariantImages(parsed[variantIndex]),
            url,
          ]);
          parsed[variantIndex].image = parsed[variantIndex].images[0];
          const updatedVariantsText = formatVariantsForTextarea(parsed);
          setForm((prev) => ({
            ...prev,
            variants: updatedVariantsText,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to upload variant image:', err);
      alert('Failed to upload variant image.');
    } finally {
      setUploadingVariantIndex(null);
    }
  };

  const handleVariantImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, variantIndex: number) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files) {
      await uploadVariantImageFile(file, variantIndex);
    }
    e.target.value = '';
  };

  // Drag & drop straight onto a design card - same upload as the picker above.
  const handleVariantImageDrop = async (e: React.DragEvent<HTMLDivElement>, variantIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverVariantIndex(null);
    if (uploadingVariantIndex !== null) return;

    const dropped = Array.from(e.dataTransfer?.files || []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (dropped.length === 0) {
      alert('Please drop an image file.');
      return;
    }

    for (const file of dropped) {
      await uploadVariantImageFile(file, variantIndex);
    }
  };

  // Removes one picture from a design (by its position in that design's list).
  const removeVariantImageAt = (variantIndex: number, imageIndex: number) => {
    const parsed = parseVariants(form.variants, form.stock);
    if (!parsed[variantIndex]) return;

    const remaining = getVariantImages(parsed[variantIndex]).filter((_, i) => i !== imageIndex);
    parsed[variantIndex].images = remaining.length > 0 ? remaining : undefined;
    parsed[variantIndex].image = remaining[0];
    if (!remaining.length) {
      delete parsed[variantIndex].images;
      delete parsed[variantIndex].image;
    }

    setForm((prev) => ({
      ...prev,
      variants: formatVariantsForTextarea(parsed),
    }));
  };

  // Descriptions are typed into one textarea per design. The text is kept in a ref
  // while typing (so spaces/caret behave normally) and written into the variants
  // list on blur / right before saving.
  const variantDescRefs = useRef<Record<number, string>>({});

  const applyVariantDescriptions = (
    variantsText: string,
    includePendingDrafts = false
  ): { text: string; parsed: ReturnType<typeof parseVariants> } => {
    const parsed = parseVariants(variantsText, form.stock);
    let changed = false;

    Object.entries(variantDescRefs.current).forEach(([indexKey, value]) => {
      const index = Number(indexKey);
      if (!parsed[index]) return;
      const clean = (value || '').replace(/\s+/g, ' ').trim();
      if (clean && parsed[index].description !== clean) {
        parsed[index].description = clean;
        changed = true;
      } else if (!clean && parsed[index].description) {
        delete parsed[index].description;
        changed = true;
      }
      if (includePendingDrafts) delete variantDescRefs.current[index];
    });

    return { text: changed ? formatVariantsForTextarea(parsed) : variantsText, parsed };
  };

  const removeVariantDescription = (variantIndex: number) => {
    delete variantDescRefs.current[variantIndex];
    const parsed = parseVariants(form.variants, form.stock);
    if (parsed[variantIndex]) {
      delete parsed[variantIndex].description;
      setForm((prev) => ({
        ...prev,
        variants: formatVariantsForTextarea(parsed),
      }));
    }
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const commitVariantDescription = () => {
    const { text } = applyVariantDescriptions(form.variants, true);
    if (text !== form.variants) {
      setForm((prev) => ({ ...prev, variants: text }));
    }
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
    const featuresList = form.features
      .split("\n")
      .map((feature) => feature.trim())
      .filter(Boolean);

    // Parse entered variants (e.g. "Red: 5" or "Blue - 3") and merge in any design
    // description that is still being typed in its box (not blurred yet).
    const { parsed: parsedVariantsList } = applyVariantDescriptions(form.variants, true);
    const variantsForStorage = formatVariantsForStorage(parsedVariantsList);
    // If variants were entered, calculate effective total stock across them
    const finalStock = parsedVariantsList.length > 0
      ? calculateEffectiveStock(form.stock, parsedVariantsList)
      : form.stock;

    try {
      const productToSave = {
        id: productId,
        name: form.name,
        description: form.description,
        features: featuresList,
        variants: variantsForStorage,
        price: form.price,
        category: form.category,
        stock: finalStock,
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

      if (result.warning) {
        alert(result.warning);
      }

      const productData = {
        id: productId,
        name: form.name,
        description: form.description,
        features: featuresList,
        variants: variantsForStorage,
        price: form.price,
        category: form.category,
        stock: finalStock,
        rating: form.rating,
        image: form.images[0],
        images: form.images,
        inStock: finalStock > 0,
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
        features: "",
        variants: "",
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
      
      const parsedVars = parseVariants(product.variants, product.stock ?? 1);
      const variantsText = parsedVars.length > 0
        ? formatVariantsForTextarea(parsedVars)
        : (typeof product.variants === "string" ? product.variants : Array.isArray(product.variants) ? product.variants.join("\n") : "");

      setForm({
        name: product.name,
        description: product.description,
        features:
          typeof product.features === "string"
            ? product.features
            : Array.isArray(product.features)
              ? product.features.join("\n")
              : "",
        variants: variantsText,
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
              features: "",
              variants: "",
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
                Product Features (one per line)
              </label>
              <textarea
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                placeholder={"Premium acrylic charm\nDurable metal keyring\nVivid printed artwork"}
                rows={4}
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Each line becomes a bullet point in the &quot;Product Features&quot;
                section on the product page.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground block mb-2">
                Variants / Designs with Stock (optional — one per line, e.g. &quot;Red: 10&quot;)
              </label>
              <textarea
                value={form.variants}
                onChange={(e) => setForm({ ...form, variants: e.target.value })}
                placeholder={"Vegeta Base Form: 5\nVegeta Super Saiyan: 4\nVegeta Super Saiyan Blue: 3"}
                rows={4}
                className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional — only for keychains that come in multiple colors or
                designs. Format each line as <code className="text-accent">Design Name: Stock</code> (e.g. <code className="text-accent">Red: 10</code>).
                Each variant gets its own independent stock counter and pill on the product page.
                Total stock will automatically sum up across all variants.
                Pictures are uploaded in the panel below and each design&apos;s description is typed there too
                (stored as <code className="text-accent">Name: Stock | image: url | desc: text</code>).
              </p>

              {/* Variant Sub-Pictures Section */}
              {(() => {
                const parsed = parseVariants(form.variants, form.stock);
                if (parsed.length === 0) return null;
                const withPictures = parsed.filter((v) => v.image).length;
                const withDescriptions = parsed.filter((v) => v.description).length;
                return (
                  <div className="mt-4 p-4 bg-card/60 border-2 border-accent/30 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-7 h-7 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-accent" />
                      </span>
                      <p className="text-sm font-bold text-foreground">
                        Pictures &amp; Descriptions for Each Variant / Design
                      </p>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30 font-semibold">
                        {withPictures}/{parsed.length} pictures
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-foreground border border-border font-semibold">
                        {withDescriptions}/{parsed.length} descriptions
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Each design gets its own picture + optional description, and the
                      customer sees them all in the &quot;Choose Your Design&quot; cards on the
                      keychain page (every card has its own Add to Cart, all at the same price).
                      Selecting a design switches the big product image to its picture.
                      <br />
                      <span className="text-accent">
                        Drag &amp; drop a picture straight onto a design card
                      </span>{" "}
                      (or click the card to browse) — exactly like uploading the
                      keychain photos.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {parsed.map((v, vIdx) => {
                        const designImages = getVariantImages(v);
                        const atLimit = designImages.length >= MAX_VARIANT_IMAGES;
                        return (
                        <div
                          key={vIdx}
                          className={`bg-background/60 border rounded-xl overflow-hidden transition-colors ${
                            designImages.length > 0 ? "border-accent/50" : "border-border"
                          }`}
                        >
                          {/* Up to 3 pictures per design. Drag & drop them here, or use
                              the Choose pictures button below. */}
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (uploadingVariantIndex === null) {
                                setDragOverVariantIndex(vIdx);
                              }
                            }}
                            onDragLeave={() => setDragOverVariantIndex(null)}
                            onDrop={(e) => handleVariantImageDrop(e, vIdx)}
                            className={`relative group w-full h-28 border-b border-dashed transition-colors ${
                              dragOverVariantIndex === vIdx
                                ? "bg-accent/20 border-accent"
                                : designImages.length > 0
                                  ? "bg-card/80 border-transparent"
                                  : "bg-card/40 border-border hover:bg-accent/10"
                            }`}
                          >
                            {designImages.length > 0 ? (
                              <>
                                <img
                                  src={designImages[0]}
                                  alt={v.name}
                                  className="w-full h-full object-cover"
                                />
                                {designImages.length > 1 && (
                                  <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded-full bg-black/70 text-white font-semibold">
                                    1 / {designImages.length}
                                  </span>
                                )}
                                {dragOverVariantIndex === vIdx && (
                                  <div className="absolute inset-0 bg-accent/25 flex flex-col items-center justify-center gap-1 pointer-events-none">
                                    <Upload className="w-5 h-5 text-accent" />
                                    <span className="text-[11px] font-semibold text-accent">
                                      {atLimit ? "Limit reached (3)" : "Add pictures"}
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-2 text-center">
                                {uploadingVariantIndex === vIdx ? (
                                  <Loader2 className="w-5 h-5 animate-spin text-accent" />
                                ) : (
                                  <Upload className="w-5 h-5 text-accent" />
                                )}
                                <span className="text-[11px] text-accent font-medium">
                                  {dragOverVariantIndex === vIdx
                                    ? "Drop it here"
                                    : "Drag & drop pictures"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  up to {MAX_VARIANT_IMAGES} per design
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Thumbnail strip - click to promote to main, X removes that one. */}
                          {designImages.length > 0 && (
                            <div className="flex gap-1.5 p-2 pb-0">
                              {designImages.map((img, imgIdx) => (
                                <div key={img} className="relative group/thumb flex-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const reordered = [
                                        img,
                                        ...designImages.filter((u) => u !== img),
                                      ];
                                      const parsedNow = parseVariants(form.variants, form.stock);
                                      if (parsedNow[vIdx]) {
                                        parsedNow[vIdx].images = reordered;
                                        parsedNow[vIdx].image = reordered[0];
                                        setForm((prev) => ({
                                          ...prev,
                                          variants: formatVariantsForTextarea(parsedNow),
                                        }));
                                      }
                                    }}
                                    title={
                                      imgIdx === 0
                                        ? "Main picture"
                                        : "Make this the main picture"
                                    }
                                    className={`block w-full h-12 rounded overflow-hidden border-2 ${
                                      imgIdx === 0 ? "border-accent" : "border-border"
                                    }`}
                                  >
                                    <img
                                      src={img}
                                      alt={`${v.name} ${imgIdx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeVariantImageAt(vIdx, imgIdx)}
                                    title="Remove this picture"
                                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-lg opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                  {imgIdx === 0 && (
                                    <span className="absolute bottom-0 left-0 text-[8px] px-1 bg-accent text-accent-foreground font-bold rounded-tr">
                                      MAIN
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="p-2 space-y-1.5">
                            <p className="text-xs font-semibold text-foreground truncate">
                              {v.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Stock: {v.stock}
                            </p>
                            <textarea
                              key={`desc-${editingProductId || 'new-product'}-${v.name}`}
                              defaultValue={v.description || ''}
                              onChange={(e) => {
                                variantDescRefs.current[vIdx] = e.target.value;
                              }}
                              onBlur={() => commitVariantDescription()}
                              placeholder="Description (optional) — e.g. Blue haired Super Saiyan form"
                              rows={2}
                              className="w-full px-2 py-1 text-[11px] bg-background/70 border border-border rounded-md text-foreground focus:outline-none focus:border-accent resize-none"
                            />
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] text-muted-foreground">
                                Pictures ({designImages.length}/{MAX_VARIANT_IMAGES})
                              </label>
                              {v.description ? (
                                <button
                                  type="button"
                                  onClick={() => removeVariantDescription(vIdx)}
                                  className="text-[11px] text-muted-foreground hover:text-red-400"
                                  title="Clear this design's description"
                                >
                                  Clear desc
                                </button>
                              ) : null}
                            </div>
                            <input
                              type="file"
                              multiple
                              accept="image/*"
                              disabled={uploadingVariantIndex !== null || atLimit}
                              onChange={(e) => handleVariantImageUpload(e, vIdx)}
                              title={
                                atLimit
                                  ? `This design already has the maximum of ${MAX_VARIANT_IMAGES} pictures`
                                  : `Choose up to ${MAX_VARIANT_IMAGES} pictures for this design (or drag & drop them on the box above)`
                              }
                              className="w-full px-2 py-1 text-[11px] bg-background/70 border border-border rounded-md text-muted-foreground focus:outline-none focus:border-accent file:bg-accent file:text-accent-foreground file:border-0 file:rounded file:px-2 file:py-1 file:mr-2 file:text-[11px] file:font-medium hover:file:bg-accent/90 disabled:opacity-50"
                            />
                            {uploadingVariantIndex === vIdx && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Uploading...
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-muted-foreground block mb-2">
                Product Images * (Max 5)
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!isUploading && form.images.length < 5) {
                    setIsDraggingProductImages(true);
                  }
                }}
                onDragLeave={() => setIsDraggingProductImages(false)}
                onDrop={handleProductImagesDrop}
                className={`rounded-xl border-2 border-dashed p-3 transition-colors ${
                  isDraggingProductImages
                    ? "border-accent bg-accent/10"
                    : "border-border bg-background/30"
                }`}
              >
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
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-accent shrink-0" />
                  {isDraggingProductImages
                    ? "Drop to upload"
                    : "Drag & drop your photos here, or pick them with the button above."}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Max 10MB per image. Large photos are auto-compressed before
                upload so product pages keep loading fast.
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
                    features: "",
                    variants: "",
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
                  {(product as any).stock > 0
                    ? `In Stock (${(product as any).stock})`
                    : "Out of Stock"}
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
