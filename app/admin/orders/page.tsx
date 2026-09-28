'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RefreshCw, Trash2, Edit2, Check, X, Eye, MessageCircle } from 'lucide-react';
import { NAYAPAY_ACCOUNT_NAME, NAYAPAY_ACCOUNT_NUMBER, HEROIX_WHATSAPP_DISPLAY } from '@/lib/store-config';

interface OrderItem {
  product?: string;
  name?: string;
  variant?: string;
  productId: string;
  quantity: number;
  price: number;
}

interface Order {
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
  items_data?: OrderItem[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
};

const statusOptions = ['pending', 'processing', 'shipped', 'delivered'];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewOrder, setViewOrder] = useState<Order | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/orders');
      const data = await response.json();
      if (data.success) {
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/orders?id=${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        setOrders(orders.map(o => 
          o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o
        ));
      }
    } catch (error) {
      console.error('Failed to update order:', error);
    }
    setEditingId(null);
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    try {
      const response = await fetch(`/api/orders?id=${orderId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setOrders(orders.filter(o => o.id !== orderId));
      }
    } catch (error) {
      console.error('Failed to delete order:', error);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone.includes(searchTerm) ||
      order.city.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatItems = (items_data?: OrderItem[]) => {
    if (!items_data || items_data.length === 0) return 'N/A';
    return items_data
      .map(i => {
        const title = i.product || i.name || 'Unknown';
        const variantPart = i.variant && !title.includes(`(${i.variant})`) ? ` [${i.variant}]` : '';
        return `${i.quantity}x ${title}${variantPart}`;
      })
      .join(', ');
  };

  const itemTitle = (item: OrderItem) => item.product || item.name || 'Unknown';

  const itemVariant = (item: OrderItem) => {
    const title = itemTitle(item);
    return item.variant && !title.includes(`(${item.variant})`) ? item.variant : '';
  };

  const itemsLineTotal = (item: OrderItem) => (item.price || 0) * (item.quantity || 0);

  const itemsCount = (order: Order) =>
    order.items_data && order.items_data.length > 0
      ? order.items_data.reduce((sum, i) => sum + (i.quantity || 0), 0)
      : order.items || 0;

  // wa.me link so the NayaPay payment can be confirmed with the customer
  const whatsappLink = (phone: string) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return '';
    const intl = digits.startsWith('92') ? digits : digits.startsWith('0') ? `92${digits.slice(1)}` : `92${digits}`;
    return `https://wa.me/${intl}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">Manage customer orders and track deliveries</p>
        </div>
        <Button
          onClick={loadOrders}
          disabled={loading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Payment reminder - an order is only confirmed once the NayaPay payment is received */}
      <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          💳 Payment: NayaPay only — {NAYAPAY_ACCOUNT_NUMBER} ({NAYAPAY_ACCOUNT_NAME}).
        </span>{' '}
        An order is NOT confirmed until the payment is received. Message the customer on
        WhatsApp ({HEROIX_WHATSAPP_DISPLAY}) to collect the payment, and move the order to
        &quot;processing&quot; only after the payment screenshot is received.
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by Order ID, Customer, Phone, or City..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              All
            </Button>
            {statusOptions.map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-sm font-semibold">Order ID</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Customer</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Contact</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Items</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Total</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm">{order.id}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{order.date}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{order.customer || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{order.city || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm">{order.phone || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{order.address}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm align-top min-w-[260px]">
                      {order.items_data && order.items_data.length > 0 ? (
                        <div className="max-h-44 overflow-y-auto pr-2 space-y-1">
                          {order.items_data.map((item, idx) => (
                            <div key={idx} className="whitespace-normal break-words leading-snug">
                              <span className="font-semibold">{item.quantity}x</span>{' '}
                              <span>{itemTitle(item)}</span>
                              {itemVariant(item) ? (
                                <span className="text-muted-foreground"> [{itemVariant(item)}]</span>
                              ) : null}
                              <span className="text-muted-foreground"> — Rs {itemsLineTotal(item).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewOrder(order)}
                        className="mt-2 text-xs font-medium text-accent hover:underline"
                      >
                        View full order ({itemsCount(order)} pcs)
                      </button>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      Rs {order.total?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === order.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="text-sm border rounded px-2 py-1"
                          >
                            {statusOptions.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStatusUpdate(order.id, editStatus)}
                          >
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize cursor-pointer ${statusColors[order.status]}`}
                          onClick={() => {
                            setEditingId(order.id);
                            setEditStatus(order.status);
                          }}
                        >
                          {order.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          title="View full order"
                          onClick={() => setViewOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(order.id);
                            setEditStatus(order.status);
                          }}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteOrder(order.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Summary */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold">{orders.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {orders.filter(o => o.status === 'pending').length}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Processing</p>
            <p className="text-2xl font-bold text-blue-600">
              {orders.filter(o => o.status === 'processing').length}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Shipped</p>
            <p className="text-2xl font-bold text-purple-600">
              {orders.filter(o => o.status === 'shipped').length}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Delivered</p>
            <p className="text-2xl font-bold text-green-600">
              {orders.filter(o => o.status === 'delivered').length}
            </p>
          </div>
        </div>
      </Card>

      {/* Full order details — everything a big order contains, scrollable */}
      {viewOrder && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
          onClick={() => setViewOrder(null)}
        >
          <div className="my-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Card className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Order {viewOrder.id}</h2>
                  <p className="text-sm text-muted-foreground">
                    {viewOrder.date} • <span className="capitalize">{viewOrder.status}</span>
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setViewOrder(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{viewOrder.customer || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{viewOrder.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium break-words">{viewOrder.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">City</p>
                  <p className="font-medium">{viewOrder.city || 'N/A'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium break-words">{viewOrder.address || 'N/A'}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-foreground mb-2">
                  Items ({itemsCount(viewOrder)} pcs / {viewOrder.items_data?.length || 0} line items)
                </p>
                {viewOrder.items_data && viewOrder.items_data.length > 0 ? (
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {viewOrder.items_data.map((item, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-4 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium break-words">
                            {item.quantity}x {itemTitle(item)}
                            {itemVariant(item) ? ` [${itemVariant(item)}]` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Rs {(item.price || 0).toLocaleString()} each
                            {item.productId ? ` • ${item.productId}` : ''}
                          </p>
                        </div>
                        <p className="font-semibold whitespace-nowrap">
                          Rs {itemsLineTotal(item).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{formatItems(viewOrder.items_data)}</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <p className="text-muted-foreground">Order total</p>
                <p className="text-2xl font-bold text-accent">
                  Rs {(viewOrder.total || 0).toLocaleString()}
                </p>
              </div>

              <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-muted-foreground">
                💳 Payment: NayaPay only — {NAYAPAY_ACCOUNT_NUMBER} ({NAYAPAY_ACCOUNT_NAME}). The
                order is not confirmed until the payment is received. Collect the screenshot on
                WhatsApp {HEROIX_WHATSAPP_DISPLAY}.
              </div>

              {whatsappLink(viewOrder.phone) && (
                <Button asChild className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
                  <a href={whatsappLink(viewOrder.phone)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4" />
                    Message customer on WhatsApp
                  </a>
                </Button>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
