import { getProductsFromSupabase, saveProductsToSupabase } from './db';
import { supabase } from './supabase';

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
  created_at?: string;
  updated_at?: string;
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
    const cleanedProducts = products.map(p => {
      const firstImage = p.images?.[0] || p.image || '/placeholder.jpg';
      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: p.price,
        category: p.category,
        stock: p.stock || 0,
        image: firstImage,
        rating: p.rating || 4.5,
        reviews: p.reviews || 0,
        created_at: p.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
    
    const { error } = await (supabase as any)
      .from('products')
      .upsert(cleanedProducts, { onConflict: 'id' });

    if (error) {
      console.error('Supabase save error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error saving products to Supabase:', error);
    return false;
  }
}

export async function addServerProduct(product: Product): Promise<boolean> {
  try {
    const firstImage = product.images?.[0] || product.image || '/placeholder.jpg';
    const productData = {
      id: product.id,
      name: product.name,
      description: product.description || '',
      price: product.price,
      category: product.category,
      stock: product.stock || 0,
      image: firstImage,
      rating: product.rating || 4.5,
      reviews: product.reviews || 0,
      created_at: product.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await (supabase as any)
      .from('products')
      .upsert([productData], { onConflict: 'id' });

    if (error) {
      console.error('Error adding product to Supabase:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error adding product:', error);
    return false;
  }
}

export async function deleteServerProduct(productId: string): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Error deleting product from Supabase:', error);
      return false;
    }
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


