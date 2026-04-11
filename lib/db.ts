import { supabase } from './supabase';

const DEFAULT_PRODUCTS = [
  { id: 'neon-genesis', name: 'Neon Genesis Evangelion', description: 'Classic mecha anime keychain with iconic EVA Unit design', price: 599, category: 'Anime', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.8, reviews: 342, stock: 50, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'attack-titan', name: 'Attack on Titan', description: 'Dynamic action keychain featuring the Scout Regiment emblem', price: 549, category: 'Anime', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.9, reviews: 567, stock: 75, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'demon-slayer', name: 'Demon Slayer', description: 'Beautiful Demon Slayer Corps insignia keychain with sword charm', price: 649, category: 'Anime', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.7, reviews: 421, stock: 60, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'jujutsu-kaisen', name: 'Jujutsu Kaisen', description: 'Sorcery-themed keychain with Jujutsu High emblem', price: 599, category: 'Anime', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.8, reviews: 389, stock: 45, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'my-hero', name: 'My Hero Academia', description: 'Heroes and villains collection keychain from the hit series', price: 499, category: 'Anime', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.6, reviews: 298, stock: 40, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'steins-gate', name: 'Steins;Gate', description: 'Time travel sci-fi keychain with iconic lab emblem', price: 549, category: 'Anime', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.9, reviews: 245, stock: 35, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'batman', name: 'Batman Icon', description: 'Dark Knight Batman emblem keychain with premium finish', price: 599, category: 'Superhero', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.8, reviews: 312, stock: 55, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'superman', name: 'Superman Shield', description: 'Iconic Superman S shield keychain with vibrant colors', price: 599, category: 'Superhero', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.7, reviews: 287, stock: 50, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'wonder-woman', name: 'Wonder Woman Lasso', description: 'Wonder Woman inspired keychain with golden accents', price: 649, category: 'Superhero', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.9, reviews: 198, stock: 40, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'iron-man', name: 'Iron Man Arc Reactor', description: 'Glowing Iron Man arc reactor keychain replica', price: 699, category: 'Marvel', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.9, reviews: 456, stock: 65, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'spider-man', name: 'Spider-Man Web', description: 'Spider-Man web design keychain with red and blue finish', price: 549, category: 'Marvel', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.8, reviews: 387, stock: 60, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'thor-hammer', name: 'Thor Mjolnir', description: 'Mighty Mjolnir hammer keychain with detailed sculpting', price: 749, category: 'Marvel', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.9, reviews: 523, stock: 45, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'flash', name: 'The Flash Lightning', description: 'The Flash lightning bolt keychain with metallic finish', price: 549, category: 'DC', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.7, reviews: 264, stock: 40, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'aquaman', name: 'Aquaman Trident', description: 'Aquaman trident keychain with ocean blue accents', price: 599, category: 'DC', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.6, reviews: 156, stock: 35, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'ronaldo-7', name: 'Cristiano Ronaldo CR7', description: 'Cristiano Ronaldo CR7 football legend keychain', price: 499, category: 'Sports', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.8, reviews: 612, stock: 70, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'messi-10', name: 'Lionel Messi 10', description: 'Lionel Messi football icon keychain with premium quality', price: 499, category: 'Sports', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.9, reviews: 598, stock: 65, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  { id: 'football-trophy', name: 'Football Trophy', description: 'Golden football trophy keychain for sports enthusiasts', price: 449, category: 'Sports', image: '/placeholder.jpg', images: ['/placeholder.jpg'], inStock: true, rating: 4.5, reviews: 178, stock: 50, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
];

let productsInitialized = false;

export async function getProducts(): Promise<any[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('products')
      .select('id, name, category, price, stock, description, image, images, rating, reviews');
    
    if (error) {
      console.error('Supabase error:', error);
      return DEFAULT_PRODUCTS;
    }
    
    if (data && data.length > 0) {
      return data.map((p: any) => ({
        ...p,
        image: p.image || '/placeholder.jpg',
        images: p.image ? [p.image] : ['/placeholder.jpg']
      }));
    }
    
    return DEFAULT_PRODUCTS;
  } catch (error) {
    console.error('Error fetching from Supabase:', error);
    return DEFAULT_PRODUCTS;
  }
}

export async function saveProducts(productsToSave: any[]): Promise<void> {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const cleanedProducts = productsToSave.map(p => {
        const imgArray = p.images && p.images.length > 0 ? p.images : (p.image ? [p.image] : ['/placeholder.jpg']);
        const img = imgArray[0];
        return {
          id: p.id,
          name: p.name,
          description: p.description || '',
          price: p.price,
          category: p.category || 'Anime',
          stock: p.stock || 0,
          image: img,
          images: imgArray,
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
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        console.error('Supabase save error:', error);
        return;
      }
      return;
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      console.error('Error saving to Supabase:', error);
    }
  }
}

export async function saveProductsToSupabase(productsToSave: any[]): Promise<void> {
  try {
    const productsWithTimestamp = productsToSave.map(p => {
      const imgArray = p.images && p.images.length > 0 ? p.images : (p.image ? [p.image] : ['/placeholder.jpg']);
      return {
        ...p,
        image: imgArray[0],
        images: imgArray,
        updated_at: new Date().toISOString()
      };
    });

    const { error } = await (supabase as any)
      .from('products')
      .upsert(productsWithTimestamp, { onConflict: 'id' });

    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveProductsToSupabase:', error);
    throw error;
  }
}

export async function getProductsFromSupabase(): Promise<any[]> {
  return getProducts();
}

export async function addProductToSupabase(product: any): Promise<boolean> {
  try {
    const productData = {
      id: product.id || `prod_${Date.now()}`,
      name: product.name,
      description: product.description || '',
      price: product.price,
      category: product.category || 'Anime',
      stock: product.stock || 0,
      image: product.image || '/placeholder-product.png',
      images: product.images || ['/placeholder-product.png'],
      rating: product.rating || 4.5,
      reviews: product.reviews || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await (supabase as any)
      .from('products')
      .upsert([productData], { onConflict: 'id' });

    if (error) {
      console.error('Supabase insert error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error adding product:', error);
    return false;
  }
}

export async function updateProductInSupabase(productId: string, updates: any): Promise<boolean> {
  try {
    const { error } = await (supabase as any)
      .from('products')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId);

    if (error) {
      console.error('Supabase update error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error updating product:', error);
    return false;
  }
}

export async function deleteProductFromSupabase(productId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      console.error('Supabase delete error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    return false;
  }
}

export interface Order {
  id: string;
  date: string;
  customer: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  items: number;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  items_data?: any[];
  created_at?: string;
  updated_at?: string;
}

export async function getOrders(): Promise<Order[]> {
  try {
    const { data, error, status } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Supabase orders error:', {
        message: error.message,
        details: error.details,
        code: error.code,
        status
      });
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

export async function addOrderToSupabase(order: Order): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .insert([{
        id: order.id,
        date: order.date,
        customer: order.customer,
        email: order.email,
        phone: order.phone,
        address: order.address,
        city: order.city,
        items: order.items,
        total: order.total,
        status: order.status,
        items_data: order.items_data || [],
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Supabase order insert error:', error.message, error.code, error.status);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error('Error adding order:', error.message);
    return false;
  }
}

export async function updateOrderInSupabase(orderId: string, updates: Partial<Order>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) {
      console.error('Supabase order update error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error updating order:', error);
    return false;
  }
}

export async function deleteOrderFromSupabase(orderId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) {
      console.error('Supabase order delete error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting order:', error);
    return false;
  }
}
