import { getOrders as getOrdersFromSupabase, addOrderToSupabase, updateOrderInSupabase, deleteOrderFromSupabase } from './db';
import { adminSupabase } from './supabase-admin';

export interface AdminOrder {
  id: string;
  /**
   * Short customer-facing number (1001, 1002, ...).
   *
   * DISPLAY ONLY - NEVER A LOOKUP KEY. It is sequential and therefore trivially
   * guessable. `id` (the UUID) is what every lookup, update and delete must use;
   * see the note in addOrderIdempotent below.
   *
   * Optional because migration 003 adds the column later than this code ships:
   * until it is applied every order has no number and the UI shows a fallback.
   */
  order_number?: number | null;
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
}

export async function getOrders(): Promise<AdminOrder[]> {
  try {
    const orders = await getOrdersFromSupabase();
    return orders.map(o => ({
      id: o.id,
      // Display number. Falls back to null before migration 003 is applied, and
      // the UI renders the id instead. Required here or the admin list would
      // silently drop the column, because this map rebuilds every field.
      order_number: (o as any).order_number ?? null,
      date: o.date || o.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      customer: o.customer,
      email: o.email || '',
      phone: o.phone || '',
      address: o.address || '',
      city: o.city || '',
      items: o.items || 0,
      total: o.total || 0,
      status: o.status || 'pending',
      items_data: o.items_data || []
    }));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

export async function addOrder(order: AdminOrder): Promise<boolean> {
  try {
    // addOrderToSupabase never throws - it reports failure via its return value,
    // so it must be propagated. Previously this always returned true, which made
    // the chatbot/checkout tell the customer the order was placed even when the
    // insert had failed.
    const saved = await addOrderToSupabase(order);
    if (!saved) {
      console.error(`Failed to save order ${order.id} to database (customer: ${order.customer}, phone: ${order.phone})`);
    }
    return saved;
  } catch (error: any) {
    console.error('Failed to save order to database:', error?.message || error);
    return false;
  }
}

/** First customer-facing number. Change here to renumber future orders. */
export const FIRST_ORDER_NUMBER = 1001;

export interface IdempotentResult {
  saved: boolean;
  /** True when an order with this id already existed (a replayed request). */
  duplicate: boolean;
  /** The customer-facing number (1001, 1002, ...). Null until migration 003. */
  orderNumber?: number | null;
  error?: string;
}

/**
 * Finds the next free customer-facing number by reading the current maximum.
 *
 * WHY NOT A POSTGRES SEQUENCE
 * A sequence is non-transactional: it hands out 1005, 1006, 1007 and never
 * reuses them even if the insert that consumed one rolled back, so gaps open up
 * whenever an order fails to save. `MAX(order_number) + 1` produces a dense
 * 1001, 1002, 1003... with no holes, which is what a customer-facing number
 * should look like.
 *
 * Two concurrent checkouts can read the same MAX and both try to claim it. That
 * is fine: migration 003 puts a UNIQUE index on order_number, the loser's
 * insert fails, and the caller retries with the next number. Correctness comes
 * from the constraint, not from this read.
 */
async function nextOrderNumber(client: any): Promise<number | null> {
  const { data, error } = await client
    .from('orders')
    .select('order_number')
    .not('order_number', 'is', null)
    .order('order_number', { ascending: false })
    .limit(1);

  // Migration 003 has not been applied yet: the column cannot be read or
  // written. Returning null lets the insert proceed unnumbered, so checkout
  // keeps working before the migration is run.
  if (error) {
    if (!/column .* does not exist/i.test(error.message || '')) {
      console.error('Could not read the order counter:', error.message);
    }
    return null;
  }

  // The column exists and works. No numbered rows yet means this is the very
  // first order, which is where the sequence starts. Returning null here
  // instead would leave the first order unnumbered and the counter stuck
  // forever, because every later read would still see no numbered rows.
  if (!data || data.length === 0) {
    return FIRST_ORDER_NUMBER;
  }

  return Number(data[0].order_number) + 1;
}

/**
 * Inserts an order, treating a repeated `id` as success rather than failure.
 *
 * IDEMPOTENCY WITHOUT A SCHEMA CHANGE
 * The client generates a UUID per checkout attempt and sends it as the order id.
 * `orders.id` is already the primary key, so the database itself guarantees
 * uniqueness - a duplicate submission collides on insert instead of creating a
 * second row. On collision we read the existing order back and report it as a
 * replay, so a double-click, a retry after a timeout, or a refresh-then-resubmit
 * all return the SAME order rather than creating another one.
 *
 * This replaces the old approach, which read the entire orders table to build a
 * Set of existing ids. That was both slow (an unbounded scan on every checkout)
 * and racy (a concurrent insert was invisible to the Set, so collisions still
 * happened).
 */
export async function addOrderIdempotent(order: AdminOrder): Promise<IdempotentResult> {
  const client = adminSupabase as any;

  // Every concurrent checkout reads the same maximum, so all but one lose the
  // first round. A generous budget matters here: giving up would fail a real
  // customer's order during a traffic spike, which is far worse than a slow
  // response. Each retry re-reads the counter, so progress is guaranteed as
  // long as the budget holds.
  const MAX_ATTEMPTS = 12;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const next = await nextOrderNumber(client);
    // The candidate number is re-read from the counter on every attempt, so it
    // is NOT offset by `attempt`. Adding an offset on top of a fresh read skips
    // numbers that were just taken by the very requests this retry is queueing
    // behind, which burns the retry budget and can fail an order outright.
    // Re-reading alone is what makes progress: each round sees the numbers the
    // previous rounds actually committed.
    const row: Record<string, any> = {
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
    };

    // Only include the column once migration 003 has been applied; sending it
    // before then fails the insert with "column does not exist".
    if (next !== null) row.order_number = next;

    const { error } = await client.from('orders').insert([row]).select().single();

    if (!error) {
      return { saved: true, duplicate: false, orderNumber: row.order_number ?? null };
    }

    // 23505 = unique_violation. It is ambiguous on purpose: it can be the id
    // (a replay - a success) or order_number (a concurrent checkout - a retry).
    // Distinguish them by looking the id up.
    if ((error as any)?.code === '23505') {
      const { data: existing } = await client
        .from('orders')
        .select('order_number')
        .eq('id', order.id)
        .maybeSingle();

      if (existing) {
        console.warn(`Duplicate order submission ignored (id ${order.id}).`);
        return { saved: true, duplicate: true, orderNumber: existing.order_number ?? null };
      }

      lastError = error.message;
      continue; // lost the race for the display number - try the next one
    }

    console.error('Supabase order insert error:', (error as any).message, (error as any).code);
    return { saved: false, duplicate: false, error: (error as any).message };
  }

  console.error(`Could not allocate an order number after ${MAX_ATTEMPTS} attempts: ${lastError}`);
  return { saved: false, duplicate: false, error: lastError };
}

export async function updateOrder(orderId: string, updates: Partial<AdminOrder>): Promise<AdminOrder | null> {
  const success = await updateOrderInSupabase(orderId, updates);
  if (!success) {
    console.error('Failed to update order in database');
    return null;
  }
  return { ...updates, id: orderId } as AdminOrder;
}

export async function deleteOrder(orderId: string): Promise<boolean> {
  return await deleteOrderFromSupabase(orderId);
}
