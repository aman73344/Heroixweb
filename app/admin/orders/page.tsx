'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Trash2, Edit2, Check, X } from 'lucide-react';

interface OrderItem {
  product: string;
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
    return items_data.map(i => `${i.quantity}x ${i.product}`).join(', ');
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
                        <p className="font-medium">{order.customer}</p>
                        <p className="text-xs text-muted-foreground">{order.city}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm">{order.phone || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{order.address}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px]">
                      <p className="truncate" title={formatItems(order.items_data)}>
                        {formatItems(order.items_data)}
                      </p>
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
    </div>
  );
}
