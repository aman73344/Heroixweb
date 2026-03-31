import { getProductsFromSupabase, saveProductsToSupabase } from './db';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock?: number;
  description?: string;
  images?: string[];
  rating?: number;
  reviews?: number;
  inStock?: boolean;
  image?: string;
}

export async function getServerProducts(): Promise<Product[]> {
  try {
    const products = await getProductsFromSupabase();
    return products || [];
  } catch (error) {
    console.error('Error reading products from Supabase:', error);
    return [];
  }
}

export async function saveServerProducts(products: Product[]): Promise<boolean> {
  try {
    // Keep base64 images as-is for Supabase storage
    const cleanedProducts = products.map(p => ({
      ...p,
      image: p.image || p.images?.[0] || '/placeholder.jpg',
      images: p.images?.length ? p.images : [p.image || '/placeholder.jpg'],
    }));
    
    // Save to Supabase
    await saveProductsToSupabase(cleanedProducts);
    return true;
  } catch (error) {
    console.error('Error saving products to Supabase:', error);
    return false;
  }
}

export async function addServerProduct(product: Product): Promise<boolean> {
  try {
    // Get existing products
    const products = await getServerProducts();
    const existingIndex = products.findIndex((p) => p.id === product.id);

    if (existingIndex >= 0) {
      products[existingIndex] = product;
    } else {
      products.push(product);
    }

    // Save to Supabase
    await saveServerProducts(products);
    return true;
  } catch (error) {
    console.error('Error adding product:', error);
    return false;
  }
}

export async function deleteServerProduct(productId: string): Promise<boolean> {
  try {
    // Get existing products
    const products = await getServerProducts();
    const filtered = products.filter((p) => p.id !== productId);

    // Save to Supabase
    await saveServerProducts(filtered);
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    return false;
  }
}

export async function getFormattedProductsForChatbot(): Promise<string> {
  try {
    const products = await getServerProducts();
    if (products.length === 0) {
      return 'No products available currently.';
    }

    const productList = products
      .slice(0, 20)
      .map(
        (p) => `${p.name} (${p.category}): Rs ${p.price}, Stock: ${p.stock}${p.description ? ` - ${p.description}` : ''}`,
      )
      .join('\n');

    return productList;
  } catch (error) {
    console.error('Error formatting products:', error);
    return 'Product catalog unavailable.';
  }
}


