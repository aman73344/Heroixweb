// SERVER-SIDE order pricing.
//
// WHY THIS MODULE EXISTS
// The checkout used to send `price` and `total` in the request body and the
// server stored them verbatim. A customer could POST their own total, so the
// order - and therefore the WhatsApp payment request - could say "Rs 1".
//
// Every price that reaches an order is now computed HERE from the database.
// Client-supplied prices are ignored entirely, never even read.
//
// Reads use the anon-key client, which is correct: public catalogue reads stay
// on the anon key so they keep working after the RLS hardening migration.

import { adminSupabase } from './supabase-admin';
import { parseVariants, getVariantPrice, ProductVariant } from './variants';
import { defaultStoreConfig } from './store-config';

export const SHIPPING_COST = defaultStoreConfig.shipping.baseCost;

/** Hard cap so a malicious payload cannot ask for a 100k-line order. */
export const MAX_ORDER_LINES = 50;
/** Hard cap on a single line's quantity. */
export const MAX_LINE_QUANTITY = 99;

export class OrderPricingError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid' | 'unknown_product' | 'quantity',
  ) {
    super(message);
    this.name = 'OrderPricingError';
  }
}

export interface RequestedItem {
  productId?: string;
  variant?: string;
  quantity?: number;
}

export interface PricedItem {
  productId: string;
  variant?: string;
  product: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface PricedOrder {
  items: PricedItem[];
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
}

function findVariant(
  variants: ProductVariant[],
  name: string | undefined,
): ProductVariant | null {
  if (!name) return null;
  const wanted = name.trim().toLowerCase();
  return variants.find((v) => v.name.trim().toLowerCase() === wanted) ?? null;
}

/**
 * Resolves the REAL unit price for each requested line from the database.
 *
 * Precedence matches how the storefront displays prices:
 *   1. the design's own price, when it has one
 *   2. otherwise the product's price
 *
 * Throws OrderPricingError when a product does not exist, so a tampered
 * productId can never create an order.
 */
export async function priceOrderFromDatabase(
  requested: RequestedItem[],
): Promise<PricedOrder> {
  if (!Array.isArray(requested) || requested.length === 0) {
    throw new OrderPricingError('Your order has no items.', 'invalid');
  }
  if (requested.length > MAX_ORDER_LINES) {
    throw new OrderPricingError('Too many items in one order.', 'invalid');
  }

  // Collapse duplicate lines (same product + same design) BEFORE pricing so a
  // repeated line is charged once at the correct quantity.
  const merged = new Map<string, { productId: string; variant?: string; quantity: number }>();
  for (const line of requested) {
    const productId = String(line?.productId ?? '').trim();
    if (!productId) {
      throw new OrderPricingError('An item is missing its product id.', 'invalid');
    }

    const quantity = Math.floor(Number(line?.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new OrderPricingError('Item quantity must be at least 1.', 'quantity');
    }
    if (quantity > MAX_LINE_QUANTITY) {
      throw new OrderPricingError(
        `Quantity cannot exceed ${MAX_LINE_QUANTITY} per item.`,
        'quantity',
      );
    }

    const variant = line?.variant ? String(line.variant) : undefined;
    const key = `${productId}:::${(variant ?? '').trim().toLowerCase()}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += quantity;
    else merged.set(key, { productId, variant, quantity });
  }

  const ids = [...new Set([...merged.values()].map((l) => l.productId))];
  const { data, error } = await adminSupabase
    .from('products')
    .select('id, name, price, variants, stock')
    .in('id', ids);

  if (error || !data) {
    throw new OrderPricingError(
      'We could not load product prices right now. Please try again.',
      'unknown_product',
    );
  }

  const byId = new Map<string, any>((data as any[]).map((p) => [p.id, p]));
  const priced: PricedItem[] = [];

  for (const line of merged.values()) {
    const product = byId.get(line.productId);
    if (!product) {
      // Never silently drop an unknown product - that is how price tampering
      // hides. The order is rejected instead.
      throw new OrderPricingError(
        'One of the items in your cart no longer exists. Please refresh and try again.',
        'unknown_product',
      );
    }

    const designs = parseVariants(product.variants, Number(product.stock) || 0);
    const design = findVariant(designs, line.variant);
    if (line.variant && !design) {
      throw new OrderPricingError(
        `"${line.variant}" is no longer available for ${product.name}.`,
        'unknown_product',
      );
    }

    const unitPrice = Number(getVariantPrice(design, product.price));
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new OrderPricingError(
        `We could not determine the price for ${product.name}.`,
        'unknown_product',
      );
    }

    priced.push({
      productId: product.id,
      variant: design?.name,
      product: design ? `${product.name} (${design.name})` : product.name,
      price: Math.round(unitPrice),
      quantity: line.quantity,
      lineTotal: Math.round(unitPrice) * line.quantity,
    });
  }

  const subtotal = priced.reduce((sum, i) => sum + i.lineTotal, 0);
  const shipping = SHIPPING_COST;

  return {
    items: priced,
    itemCount: priced.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}
