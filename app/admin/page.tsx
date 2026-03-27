"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  mockOrders as initialOrders,
  mockProducts,
  type AdminProduct,
  type AdminOrder,
} from "@/lib/admin-store";
import { Edit2, Trash2, Plus, X } from "lucide-react";
import Link from "next/link";
import { products as allProducts } from "@/lib/products";
import { getRecentSessions, getSessionStats } from "@/lib/chatbot/context";

export default function AdminDashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders);
  const [products, setProducts] = useState<AdminProduct[]>(mockProducts);
  const [activeTab, setActiveTab] = useState("overview");
  const recentSessions = getRecentSessions(5);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [editingOrder, setEditingOrder] = useState<AdminOrder | null>(null);

  // Fetch orders from API on mount
  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch("/api/orders");
        const data = await res.json();
        if (data.success && data.data) {
          setOrders(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      }
    }
    fetchOrders();
    
    // Poll for new orders every 5 seconds
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  // Product Form State
  const [productForm, setProductForm] = useState({
    name: "",
    category: "",
    price: 0,
    stock: 0,
    description: "",
  });

  // Order Form State
  const [orderForm, setOrderForm] = useState({
    customer: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    items: 0,
    total: 0,
  });

  // Product Management
  const handleAddProduct = () => {
    if (!productForm.name || !productForm.category) {
      alert("Please fill all required fields");
      return;
    }

    if (editingProduct) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id ? { ...p, ...productForm } : p,
        ),
      );
      setEditingProduct(null);
    } else {
      const newProduct: AdminProduct = {
        id: `p-${Date.now()}`,
        ...productForm,
        status: "active",
      };
      setProducts((prev) => [...prev, newProduct]);
    }

    setProductForm({
      name: "",
      category: "",
      price: 0,
      stock: 0,
      description: "",
    });
    setShowAddProduct(false);
  };

  const handleEditProduct = (product: AdminProduct) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      category: product.category,
      price: product.price,
      stock: product.stock,
      description: product.description || "",
    });
    setShowAddProduct(true);
  };

  const handleDeleteProduct = (productId: string) => {
    if (confirm("Are you sure you want to delete this product?")) {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  const toggleProductStatus = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, status: p.status === "active" ? "inactive" : "active" }
          : p,
      ),
    );
  };

  // Order Management
  const handleAddOrder = () => {
    if (!orderForm.customer || !orderForm.email) {
      alert("Please fill all required fields");
      return;
    }

    if (editingOrder) {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === editingOrder.id ? { ...o, ...orderForm } : o,
        ),
      );
      setEditingOrder(null);
    } else {
      const newOrder: AdminOrder = {
        id: `ORD-${String(orders.length + 1).padStart(3, "0")}`,
        date: new Date().toISOString().split("T")[0],
        ...orderForm,
        status: "pending",
      };
      setOrders((prev) => [...prev, newOrder]);
    }

    setOrderForm({
      customer: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      items: 0,
      total: 0,
    });
    setShowAddOrder(false);
  };

  const handleEditOrder = (order: AdminOrder) => {
    setEditingOrder(order);
    setOrderForm({
      customer: order.customer,
      email: order.email,
      phone: order.phone || "",
      address: order.address || "",
      city: order.city || "",
      items: order.items,
      total: order.total,
    });
    setShowAddOrder(true);
  };

  const updateOrderStatus = (
    orderId: string,
    newStatus: AdminOrder["status"],
  ) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "processing":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "shipped":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "delivered":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-border p-6 space-y-2">
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-3xl font-bold text-accent">{orders.length}</p>
          </Card>
          <Card className="border-border p-6 space-y-2">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-3xl font-bold text-accent">
              Rs {orders.reduce((sum, o) => sum + o.total, 0).toLocaleString()}
            </p>
          </Card>
          <Card className="border-border p-6 space-y-2">
            <p className="text-sm text-muted-foreground">Active Products</p>
            <p className="text-3xl font-bold text-accent">
              {products.filter((p) => p.status === "active").length}/
              {products.length}
            </p>
          </Card>
          <Card className="border-border p-6 space-y-2">
            <p className="text-sm text-muted-foreground">Total Stock</p>
            <p className="text-3xl font-bold text-accent">
              {products.reduce((sum, p) => sum + p.stock, 0)}
            </p>
          </Card>
          <Card className="border-border p-6 space-y-2">
            <p className="text-sm text-muted-foreground">Chat Sessions</p>
            <p className="text-3xl font-bold text-accent">
              {recentSessions.length}
            </p>
            <p className="text-xs text-muted-foreground">active</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-4 bg-card/30 border border-border">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="products"
              className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              Products
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              Orders
            </TabsTrigger>
            <TabsTrigger
              value="chatbot"
              className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground"
            >
              Chatbot
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-border p-6">
                <h3 className="font-bold text-foreground mb-4">Quick Links</h3>
                <div className="space-y-2">
                  <Link href="/admin/products">
                    <Button
                      variant="outline"
                      className="w-full border-border text-foreground hover:bg-card justify-start"
                    >
                      Manage Products
                    </Button>
                  </Link>
                  <Link href="/admin/settings">
                    <Button
                      variant="outline"
                      className="w-full border-border text-foreground hover:bg-card justify-start"
                    >
                      Store Settings
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button
                      variant="outline"
                      className="w-full border-border text-foreground hover:bg-card justify-start"
                    >
                      Back to Store
                    </Button>
                  </Link>
                </div>
              </Card>

              <Card className="border-border p-6">
                <h3 className="font-bold text-foreground mb-4">
                  Chatbot Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Processor
                    </span>
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                      Running
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Active Sessions
                    </span>
                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                      {recentSessions.length}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Products</h2>
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({
                    name: "",
                    category: "",
                    price: 0,
                    stock: 0,
                    description: "",
                  });
                  setShowAddProduct(true);
                }}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>

            {showAddProduct && (
              <Card className="border-border p-6 space-y-4 bg-card/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-foreground">
                    {editingProduct ? "Edit Product" : "Add New Product"}
                  </h3>
                  <button
                    onClick={() => setShowAddProduct(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) =>
                        setProductForm({ ...productForm, name: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., Batman Icon"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Category *
                    </label>
                    <select
                      value={productForm.category}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          category: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                    >
                      <option value="">Select Category</option>
                      <option value="Anime">Anime</option>
                      <option value="Superhero">Superhero</option>
                      <option value="Marvel">Marvel</option>
                      <option value="DC">DC</option>
                      <option value="Sports">Sports</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Price (PKR) *
                    </label>
                    <input
                      type="number"
                      value={productForm.price}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          price: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., 599"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      value={productForm.stock}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          stock: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., 50"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm text-muted-foreground block mb-2">
                      Description
                    </label>
                    <textarea
                      value={productForm.description}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="Product description..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddProduct(false);
                      setEditingProduct(null);
                      setProductForm({
                        name: "",
                        category: "",
                        price: 0,
                        stock: 0,
                        description: "",
                      });
                    }}
                    className="border-border text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddProduct}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {editingProduct ? "Update Product" : "Add Product"}
                  </Button>
                </div>
              </Card>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Product
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Category
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Price
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Stock
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-border hover:bg-card/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <p className="text-foreground font-medium">
                          {product.name}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground text-sm">
                        {product.category}
                      </td>
                      <td className="py-3 px-4 text-foreground font-bold text-accent">
                        Rs {product.price}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            product.stock > 50
                              ? "bg-green-500/20 text-green-400"
                              : product.stock > 0
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {product.stock} units
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => toggleProductStatus(product.id)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            product.status === "active"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-red-500/20 text-red-400 border-red-500/30"
                          }`}
                        >
                          {product.status === "active" ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="py-3 px-4 flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                          className="text-accent hover:bg-accent/10"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Orders</h2>
              <Button
                onClick={() => {
                  setEditingOrder(null);
                  setOrderForm({
                    customer: "",
                    email: "",
                    phone: "",
                    address: "",
                    city: "",
                    items: 0,
                    total: 0,
                  });
                  setShowAddOrder(true);
                }}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Order
              </Button>
            </div>

            {showAddOrder && (
              <Card className="border-border p-6 space-y-4 bg-card/50">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-lg text-foreground">
                    {editingOrder ? "Edit Order" : "Add New Order"}
                  </h3>
                  <button
                    onClick={() => setShowAddOrder(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={orderForm.customer}
                      onChange={(e) =>
                        setOrderForm({ ...orderForm, customer: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., Ahmed Khan"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={orderForm.email}
                      onChange={(e) =>
                        setOrderForm({ ...orderForm, email: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., ahmed@example.com"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={orderForm.phone}
                      onChange={(e) =>
                        setOrderForm({ ...orderForm, phone: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., 0300-1234567"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={orderForm.city}
                      onChange={(e) =>
                        setOrderForm({ ...orderForm, city: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., Karachi"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={orderForm.address}
                      onChange={(e) =>
                        setOrderForm({ ...orderForm, address: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., 123 Main St"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Items
                    </label>
                    <input
                      type="number"
                      value={orderForm.items}
                      onChange={(e) =>
                        setOrderForm({
                          ...orderForm,
                          items: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., 2"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Total (PKR)
                    </label>
                    <input
                      type="number"
                      value={orderForm.total}
                      onChange={(e) =>
                        setOrderForm({
                          ...orderForm,
                          total: parseFloat(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                      placeholder="e.g., 1398"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddOrder(false);
                      setEditingOrder(null);
                      setOrderForm({
                        customer: "",
                        email: "",
                        phone: "",
                        address: "",
                        city: "",
                        items: 0,
                        total: 0,
                      });
                    }}
                    className="border-border text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddOrder}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {editingOrder ? "Update Order" : "Add Order"}
                  </Button>
                </div>
              </Card>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Order ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Customer
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Items
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Total
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-border hover:bg-card/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-foreground font-mono text-sm">
                        {order.id}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-foreground font-medium">
                            {order.customer}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-foreground">
                        {order.items}
                      </td>
                      <td className="py-3 px-4 text-foreground font-bold text-accent">
                        Rs {order.total}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={order.status}
                          onChange={(e) =>
                            updateOrderStatus(order.id, e.target.value as any)
                          }
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(order.status)} bg-transparent cursor-pointer`}
                        >
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditOrder(order)}
                          className="text-accent hover:bg-accent/10"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Chatbot Tab */}
          <TabsContent value="chatbot" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <Card className="border-border p-6">
                  <h3 className="font-bold text-foreground mb-4">
                    Active Conversations
                  </h3>
                  <div className="space-y-3">
                    {recentSessions.length > 0 ? (
                      recentSessions.map((session) => (
                        <div
                          key={session.sessionId}
                          className="p-3 border border-border rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <code className="text-xs text-muted-foreground font-mono">
                              {session.sessionId.slice(0, 20)}...
                            </code>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                session.conversationPhase === "ordering"
                                  ? "bg-accent/20 text-accent"
                                  : session.conversationPhase === "confirming"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-blue-500/20 text-blue-400"
                              }`}
                            >
                              {session.conversationPhase}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {session.messages.length} messages • Last activity:{" "}
                            {new Date(
                              session.lastActivityAt,
                            ).toLocaleTimeString()}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No active sessions
                      </p>
                    )}
                  </div>
                </Card>
              </div>

              <Card className="border-border p-6">
                <h3 className="font-bold text-foreground mb-4">
                  Chatbot Config
                </h3>
                <div className="space-y-3">
                  <Link href="/admin/settings">
                    <Button
                      variant="outline"
                      className="w-full border-border text-foreground hover:bg-card justify-start"
                    >
                      View Settings
                    </Button>
                  </Link>
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">
                      Intent Detection
                    </p>
                    <p className="text-sm text-accent font-semibold">Enabled</p>
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-2">
                      Order Processing
                    </p>
                    <p className="text-sm text-accent font-semibold">Active</p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
