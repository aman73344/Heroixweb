import { supabase } from './supabase';
// Server-side WRITES must use the service key. `supabase` above is the anon-key
// client, which the hardening migration removes write access for.
// Read paths intentionally keep using it so public catalogue reads still work.
import { adminSupabase } from './supabase-admin';
import { splitVariantImageSuffix, parseVariants, formatVariantsForStorage } from './variants';
import { normalizeRating, normalizeReviewCount } from './reviews';

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
      // Supabase/PostgREST caps a single response at its own row limit, so the
      // rows are paged in. Without this a product beyond the first page (there
      // are more than 50 in the table) simply never loads, which looks like
      // "my product/design vanished after a reload".
      const pageSize = 200;
      const page: any[] = [];
      for (let from = 0; from < 2000; from += pageSize) {
        const chunk: any = await (supabase as any)
          .from('products')
          .select(columns)
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (chunk.error) {
          error = chunk.error;
          break;
        }

        const rows = Array.isArray(chunk.data) ? chunk.data : [];
        page.push(...rows);
        if (rows.length < pageSize) break;
      }

      data = page;
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
          rating: normalizeRating(p.rating),
          reviews: normalizeReviewCount(p.reviews),
          created_at: p.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await (adminSupabase as any)
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

    const { error } = await (adminSupabase as any)
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
      rating: normalizeRating(product.rating),
      reviews: normalizeReviewCount(product.reviews),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await (adminSupabase as any)
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
    const { error } = await (adminSupabase as any)
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
    const { error } = await adminSupabase
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
    // Service key: checkout inserts must work once anon write access to `orders`
    // is removed by the RLS hardening migration.
    const { error } = await (adminSupabase as any)
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
    const { error } = await (adminSupabase as any)
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
    const { error } = await adminSupabase
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
// DEPRECATED - DO NOT USE FOR ORDER PLACEMENT.
//
// This was the old read-then-write stock check. It is kept only so any external
// caller does not break, and it has two defects that made it unsafe:
//
//   1. It FAILED OPEN: on a database error it returned an empty list, which the
//      old checkout read as "no problems" and let the order through.
//   2. It was a read-then-check, so two concurrent buyers of the last unit both
//      saw enough stock and both passed.
//
// Order placement now uses reserveStock() in lib/db.ts, which is atomic and
// fails closed. Do not reintroduce this on the checkout path.
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

    // Service key: this is a WRITE path (it updates products.stock), so it must
    // not rely on anon write access that the RLS hardening migration removes.
    const { data, error } = await (adminSupabase as any)
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

    const { error: updateError } = await (adminSupabase as any)
      .from('products')
      .update(updatePayload)
      .eq('id', productId);

    if (updateError) console.error('Stock decrement error:', updateError);
  } catch (error) {
    console.error('Error decrementing stock:', error);
  }
}

/**
 * ATOMIC stock reservation.
 *
 * The previous implementation read the stock, computed a new value in Node, and
 * wrote it back. Two customers buying the last unit at the same time both read
 * the same stock, both passed the check, and both wrote the same result - so two
 * orders were sold for one item.
 *
 * This version issues a SINGLE conditional UPDATE:
 *
 *     UPDATE products SET stock = stock - q WHERE id = p AND stock >= q
 *
 * Postgres takes a row lock for the duration of that statement, so the check and
 * the decrement cannot interleave. If it matches no row we know, definitively,
 * that there was not enough stock. There is no read-then-write window.
 *
 * When migration 002 has been applied, this delegates to the
 * `reserve_stock` Postgres function, which additionally handles per-design stock
 * and reserves every line of the order in ONE transaction. Until then it falls
 * back to the single-statement update above, which is already safe against the
 * oversell race for the product's total stock.
 *
 * ALL-OR-NOTHING: if any line of a multi-line order cannot be reserved, every
 * line that WAS already reserved is put back before this function returns. That
 * rollback lives HERE rather than in the callers, because a caller that forgets
 * it silently drains stock with no order ever created.
 */

export interface ReservationLine {
  productId: string;
  quantity: number;
  variant?: string;
}

export interface ReservationFailure {
  productId: string;
  requested: number;
  available: number;
}

export interface ReservationResult {
  ok: boolean;
  failures: ReservationFailure[];
  /**
   * Lines whose stock was actually decremented. On a failed reservation this
   * is normally empty, because reserveStock() rolls them back before
   * returning. It is exposed so callers can verify, and for the rare case
   * where the rollback itself failed.
   */
  reserved: ReservationLine[];
}

/** Injected for tests; defaults to the real service-role client. */
export interface ReservationDeps {
  client?: any;
}

const RPC_NAME = 'reserve_stock';

/** Shape sent to the reserve_stock RPC / used by the fallback loop. */
interface CleanLine {
  product_id: string;
  quantity: number;
  variant_name: string | null;
}

/** Maps the internal snake_case line back to the public ReservationLine shape. */
function toReservationLine(line: CleanLine): ReservationLine {
  return {
    productId: line.product_id,
    quantity: line.quantity,
    // `undefined`, not `null`: callers branch on truthiness, and a null would
    // serialise into a `"variant": null` field they do not expect.
    ...(line.variant_name ? { variant: line.variant_name } : {}),
  };
}

/**
 * Restores the given lines and returns the ones it could NOT put back.
 *
 * Each line is a compare-and-swap run in reverse: read the current stock, write
 * back `current + quantity`, and only commit that write if the row still holds
 * the value that was read. A concurrent order that changed the row in between
 * is therefore never clobbered - our write matches zero rows, so we re-read and
 * retry.
 *
 * The guard is what makes this safe to run while other checkouts are in
 * flight. Without it this is a classic lost update: read 10, another order
 * takes 3, then write 10 + qty instead of 7 + qty. That invents stock and is
 * precisely the oversell this module exists to prevent.
 *
 * This is a compensating action, not an atomic one. A line that still cannot be
 * restored after every attempt is RETURNED to the caller rather than silently
 * dropped, so "stock is still held for this line" is always visible. Stock left
 * low means under-selling, which is the safe direction to fail in.
 */
async function restoreLines(
  client: any,
  lines: ReservationLine[],
): Promise<ReservationLine[]> {
  const unrestored: ReservationLine[] = [];

  // Newest reservation first, so a partially completed rollback leaves the
  // most recent holds in place - the ones a retry is most likely to re-request.
  for (const line of [...lines].reverse()) {
    if (!line?.productId || !(line.quantity > 0)) continue;
    let settled = false;

    for (let attempt = 0; attempt < 5 && !settled; attempt++) {
      const { data: current, error: readError } = await (client as any)
        .from('products')
        .select('stock')
        .eq('id', line.productId)
        .maybeSingle();

      if (readError || !current) {
        console.error('Stock restore read error:', line.productId, readError);
        break;
      }

      const currentStock = Number(current.stock) || 0;

      const { data: updated, error: writeError } = await (client as any)
        .from('products')
        .update({
          stock: currentStock + line.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', line.productId)
        .eq('stock', current.stock)
        .select('stock');

      if (writeError) {
        console.error('Stock restore write error:', line.productId, writeError);
        break;
      }

      if (Array.isArray(updated) && updated.length > 0) {
        settled = true;
      }
      // else: a concurrent order moved the stock - re-read and try again.
    }

    if (!settled) {
      unrestored.push(line);
    }
  }

  return unrestored;
}

/**
 * Puts stock back when an order could not be completed after a successful
 * reservation, OR when a multi-line reservation only partly succeeded.
 *
 * This is a compensating action, not an atomic one: if it fails, stock is left
 * lower than reality. That errs towards under-selling rather than overselling,
 * which is the safe direction. Failures are logged loudly.
 */
export async function releaseStock(
  lines: ReservationLine[],
  deps: ReservationDeps = {},
): Promise<void> {
  const client = deps.client ?? adminSupabase;
  const clean = lines.filter((l) => l.productId && l.quantity > 0);

  // Shared with reserveStock's rollback so both paths restore stock under the
  // same compare-and-swap guard. The previous version here read the stock and
  // wrote back current + qty with no `.eq('stock', ...)` guard, which is a lost
  // update whenever another checkout decrements the same row in between.
  const unrestored = await restoreLines(client, clean);

  for (const line of unrestored) {
    console.error(
      'releaseStock: could not restore stock',
      line.productId,
      line.quantity,
    );
  }
}

export async function reserveStock(
  lines: ReservationLine[],
  deps: ReservationDeps = {},
): Promise<ReservationResult> {
  const client = deps.client ?? adminSupabase;
  const clean: CleanLine[] = lines
    .map((l) => ({
      product_id: String(l.productId || ''),
      quantity: Math.floor(Number(l.quantity) || 0),
      variant_name: l.variant ? String(l.variant) : null,
    }))
    .filter((l) => l.product_id && l.quantity > 0);

  if (clean.length === 0) return { ok: true, failures: [], reserved: [] };

  // Lines whose stock this call has actually decremented. Tracked so a partial
  // failure can be undone before returning, and so a fully successful call can
  // report exactly what it holds.
  const reserved: ReservationLine[] = [];

  // Preferred path: one transaction for the whole order (needs migration 002).
  try {
    const { data, error } = await (client as any).rpc(RPC_NAME, {
      p_lines: clean,
    });

    if (!error) {
      const result = Array.isArray(data) ? data[0] : data;
      return {
        ok: Boolean(result?.ok),
        failures: Array.isArray(result?.failures) ? result.failures : [],
        // The RPC validates every line before writing any UPDATE, so a failed
        // reservation never leaves partial state.
        reserved: result?.ok ? clean.map(toReservationLine) : [],
      };
    }

    // 40442 / undefined_function means the migration has not been applied yet.
    // That is expected in staging before Phase 2 SQL is run - fall through to the
    // safe single-statement path rather than failing the checkout.
    const code = (error as any)?.code;
    if (code !== '42883' && code !== 'PGRST202' && !/not exist|does not exist|find/i.test(error.message || '')) {
      throw error;
    }
    console.warn('reserve_stock RPC unavailable; using guarded UPDATE fallback.');
  } catch (error: any) {
    if (error?.code !== '42883' && error?.code !== 'PGRST202') throw error;
  }

  // Fallback: compare-and-swap on the current stock value.
  //
  // PostgREST cannot express "stock = stock - q", so this reads the current
  // value and writes back a new one ONLY if the value has not changed:
  //
  //     UPDATE products SET stock = <new> WHERE id = p AND stock = <current>
  //
  // That WHERE clause is the guard. If a competing order changed the stock in
  // between the read and the write, this matches zero rows, so we retry with the
  // fresh value. It is the same optimistic-concurrency pattern as a compare and
  // swap, and it closes the oversell window without needing a migration.
  const failures: ReservationFailure[] = [];

  for (const line of clean) {
    let settled = false;

    for (let attempt = 0; attempt < 5 && !settled; attempt++) {
      const { data: current, error: readError } = await (client as any)
        .from('products')
        .select('stock')
        .eq('id', line.product_id)
        .maybeSingle();

      if (readError || !current) {
        // Fail closed: an unknown database error must not read as "reserved".
        console.error('Stock reservation read error:', readError);
        failures.push({ productId: line.product_id, requested: line.quantity, available: 0 });
        settled = true;
        break;
      }

      const available = Number(current.stock) || 0;
      if (available < line.quantity) {
        failures.push({
          productId: line.product_id,
          requested: line.quantity,
          available,
        });
        settled = true;
        break;
      }

      const { data: updated, error: writeError } = await (client as any)
        .from('products')
        .update({
          stock: available - line.quantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', line.product_id)
        .eq('stock', current.stock)
        .select('stock');

      if (writeError) {
        console.error('Stock reservation write error:', writeError);
        failures.push({ productId: line.product_id, requested: line.quantity, available: 0 });
        settled = true;
        break;
      }

      if (Array.isArray(updated) && updated.length > 0) {
        settled = true; // won the race and decremented
        // Recorded only now, on the branch that actually changed the row, so a
        // rollback can never credit back stock this call did not take.
        reserved.push(toReservationLine(line));
      }
      // else: someone else changed stock first - loop and re-read.
    }

    if (!settled) {
      // Lost five races in a row; report as unavailable rather than guessing.
      failures.push({ productId: line.product_id, requested: line.quantity, available: 0 });
    }
  }

  if (failures.length === 0) {
    // Every line is held, so the caller now owns the responsibility to release
    // them (via releaseStock) if the order itself is not saved.
    return { ok: true, failures, reserved };
  }

  // ALL-OR-NOTHING: the caller gets no order when this returns ok:false, so
  // every line reserved by THIS call has to be put back here. It cannot be left
  // to the caller, because a caller that forgets silently drains stock with no
  // order ever created.
  //
  // Only `reserved` is restored - the lines in `failures` were never taken, and
  // crediting them back would invent stock.
  const stillHeld = await restoreLines(client, reserved);
  for (const line of stillHeld) {
    console.error(
      'reserveStock: rollback could not restore stock',
      line.productId,
      line.quantity,
    );
  }

  // `reserved` is reported as what is STILL held after the rollback, which is
  // normally empty. If a rollback itself failed the caller is told, rather than
  // the loss being swallowed.
  return { ok: false, failures, reserved: stillHeld };
}

