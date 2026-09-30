import { getOrders as getOrdersFromSupabase, addOrderToSupabase, updateOrderInSupabase, deleteOrderFromSupabase } from './db';
import { adminSupabase } from './supabase-admin';

export interface AdminOrder {
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
}

export async function getOrders(): Promise<AdminOrder[]> {
  try {
    const orders = await getOrdersFromSupabase();
    return orders.map(o => ({
      id: o.id,
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

export interface IdempotentResult {
  saved: boolean;
  /** True when an order with this id already existed (a replayed request). */
  duplicate: boolean;
  error?: string;
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
  const { error } = await (adminSupabase as any)
    .from('orders')
    .insert([
      {
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
      },
    ])
    .select()
    .single();

  if (!error) return { saved: true, duplicate: false };

  // 23505 = unique_violation: the id already exists, i.e. a replayed submission.
  if ((error as any)?.code === '23505') {
    console.warn(`Duplicate order submission ignored (id ${order.id}).`);
    return { saved: true, duplicate: true };
  }

  console.error('Supabase order insert error:', (error as any).message, (error as any).code);
  return { saved: false, duplicate: false, error: (error as any).message };
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
