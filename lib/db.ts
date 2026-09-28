import { supabase } from './supabase';
import { splitVariantImageSuffix, parseVariants, formatVariantsForStorage } from './variants';

// Kept as an offline reference of the original seed catalogue. Supabase is the
// live source of truth, so this list is intentionally not used at runtime.
/* eslint-disable @typescript-eslint/no-unused-vars */
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

export async function getProducts(): Promise<any[]> {
  try {
    // features/variants are optional columns added by
    // scripts/add-features-column.sql - skip any that don't exist yet so the
    // store keeps working before the script has been run.
    const OPTIONAL_COLUMNS = ['features', 'variants'];
    const BASE_COLUMNS = [
      'id', 'name', 'category', 'price', 'stock', 'description',
      'image', 'image_urls', 'rating', 'reviews',
    ];
    let selectedOptional = [...OPTIONAL_COLUMNS];
    let data: any = null;
    let error: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const columns = [...BASE_COLUMNS, ...selectedOptional].join(', ');
      ({ data, error } = await (supabase as any)
        .from('products')
        .select(columns)
        .limit(50));

      if (!error || (error as any).code !== '42703') break;

      const match =
        (error as any).message.match(/column\s+([\w.]+)\s+does not exist/) ||
        (error as any).message.match(/column "([^"]+)"/);
      const missing = match?.[1]?.split('.').pop();

      if (missing && selectedOptional.includes(missing)) {
        selectedOptional = selectedOptional.filter((c) => c !== missing);
        continue;
      }

      if (attempt === 0) {
        // Couldn't identify the column - drop all optional columns and retry
        selectedOptional = [];
        continue;
      }

      break;
    }

    if (error) {
      console.error('Supabase error:', error);
      return [];
    }
    
    if (data && data.length > 0) {
      return data.map((p: any) => {
        let images: string[] = ['/placeholder.jpg'];
        
        // Use image_urls array if available
        if (p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0) {
          images = p.image_urls;
        } else if (p.image) {
          images = [p.image];
        }
        
        return {
          ...p,
          image: images[0],
          images: images,
          inStock: p.stock > 0
        };
      });
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching from Supabase:', error);
    return [];
  }
}

export async function saveProducts(productsToSave: any[]): Promise<void> {
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const cleanedProducts = productsToSave.map(p => {
        return {
          id: p.id,
          name: p.name,
          description: p.description || '',
          price: p.price,
          category: p.category || 'Anime',
          stock: p.stock || 0,
          image: p.images?.[0] || p.image || '/placeholder.jpg',
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
    // Same untyped-client cast as the product writes above.
    const { error } = await (supabase as any)
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
      console.error('Supabase order insert error:', error.message, error.code);
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
    const { error } = await (supabase as any)
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

export interface StockProblem {
  productId: string;
  name: string;
  variant?: string;
  requested: number;
  available: number;
}

// Real stock counter: verify every ordered item has enough stock in the
// database before the order is saved, accounting for specific variants if selected.
// Fails open on DB errors so a flaky connection never blocks orders.
export async function verifyStockAvailability(
  items: { productId?: string; variant?: string; quantity: number }[],
): Promise<StockProblem[]> {
  const problems: StockProblem[] = [];
  try {
    const ids = [
      ...new Set(items.map((i) => i.productId).filter(Boolean)),
    ] as string[];
    if (ids.length === 0) return problems;

    const { data, error } = await (supabase as any)
      .from('products')
      .select('id, name, stock, variants')
      .in('id', ids);

    if (error || !data) {
      console.error('Stock check error:', error);
      return problems;
    }

    const productById = new Map<string, any>(
      data.map((p: any) => [p.id, p]),
    );

    // Group requested quantities by productId and variant
    const requestedKeyMap = new Map<string, { productId: string; variant?: string; quantity: number }>();
    for (const item of items) {
      if (!item.productId) continue;
      const key = `${item.productId}:::${(item.variant || '').trim().toLowerCase()}`;
      const existing = requestedKeyMap.get(key);
      if (existing) {
        existing.quantity += item.quantity || 0;
      } else {
        requestedKeyMap.set(key, {
          productId: item.productId,
          variant: item.variant?.trim() || undefined,
          quantity: item.quantity || 0,
        });
      }
    }

    for (const req of requestedKeyMap.values()) {
      const product = productById.get(req.productId);
      if (!product) continue;

      const baseStock = Number(product.stock) || 0;
      let variantStock: number | null = null;
      let matchedVariantName = req.variant;

      if (req.variant && product.variants && Array.isArray(product.variants)) {
        // Find matching variant
        for (const rawV of product.variants) {
          let str = typeof rawV === 'string' ? rawV : (rawV?.name || '');
          // Ignore an optional "| image: url" picture suffix when matching names
          str = splitVariantImageSuffix(str).main;

          const match = str.match(/^(.+?)\s*[:=]\s*(\d+)\s*$/) ||
                        str.match(/^(.+?)\s+-\s+(\d+)\s*$/) ||
                        str.match(/^(.+?)\s*\(\s*(?:stock\s*:\s*)?(\d+)(?:\s*left)?\s*\)\s*$/i);
          let vName = str;
          let vStock = baseStock;
          if (match) {
            vName = match[1].trim();
            vStock = parseInt(match[2], 10);
          } else if (typeof rawV === 'object' && rawV?.stock !== undefined) {
            vStock = Number(rawV.stock) || 0;
          }
          if (vName.toLowerCase() === req.variant.toLowerCase()) {
            variantStock = vStock;
            matchedVariantName = vName;
            break;
          }
        }
      }

      const available = variantStock !== null ? variantStock : baseStock;
      if (req.quantity > available) {
        problems.push({
          productId: req.productId,
          name: product.name,
          variant: matchedVariantName,
          requested: req.quantity,
          available,
        });
      }
    }
  } catch (error) {
    console.error('Error verifying stock:', error);
  }
  return problems;
}

// Real stock counter: reduce stock after an order is saved (never below 0).
// If a variant is specified, decrements that variant's stock count as well
// as the product's overall stock count.
export async function decrementStock(
  productId: string,
  quantity: number,
  variantName?: string,
): Promise<void> {
  try {
    if (!productId || quantity <= 0) return;

    const { data, error } = await (supabase as any)
      .from('products')
      .select('stock, variants')
      .eq('id', productId)
      .single();

    if (error || !data) {
      console.error('Stock fetch error:', error);
      return;
    }

    const currentBase = Number(data.stock) || 0;
    const nextBase = Math.max(0, currentBase - quantity);
    const updatePayload: Record<string, any> = {
      stock: nextBase,
      updated_at: new Date().toISOString(),
    };

    // If product has variants and a variant was purchased, update variant stock.
    // parseVariants/formatVariantsForStorage are used so the design's picture AND
    // description are preserved while only the stock number changes.
    if (variantName && data.variants && Array.isArray(data.variants) && data.variants.length > 0) {
      const parsedVariants = parseVariants(data.variants, currentBase);
      let stockChanged = false;

      const updatedVariants = parsedVariants.map((v) => {
        if (v.name.toLowerCase() === variantName.trim().toLowerCase()) {
          stockChanged = true;
          return { ...v, stock: Math.max(0, v.stock - quantity) };
        }
        return v;
      });

      if (stockChanged) {
        updatePayload.variants = formatVariantsForStorage(updatedVariants);
      }
    }

    const { error: updateError } = await (supabase as any)
      .from('products')
      .update(updatePayload)
      .eq('id', productId);

    if (updateError) console.error('Stock decrement error:', updateError);
  } catch (error) {
    console.error('Error decrementing stock:', error);
  }
}

// Reduce stock for every item of a saved order.
export async function decrementStockForOrder(
  items: { productId?: string; variant?: string; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    await decrementStock(item.productId || '', item.quantity || 0, item.variant);
  }
}
