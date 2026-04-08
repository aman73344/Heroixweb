import { getOrders as getOrdersFromSupabase, addOrderToSupabase, updateOrderInSupabase, deleteOrderFromSupabase, Order } from './db';

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
  const success = await addOrderToSupabase(order);
  if (!success) {
    console.error('Failed to save order to database');
  }
  return success;
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
