'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCart } from '@/lib/cart-context';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  NAYAPAY_ACCOUNT_NAME,
  NAYAPAY_ACCOUNT_NUMBER,
  HEROIX_WHATSAPP_DISPLAY,
  HEROIX_WHATSAPP_LINK,
} from '@/lib/store-config';

export default function CheckoutPage() {
  const { items, totalPrice, removeItem, updateQuantity, clearCart } = useCart();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
  });
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderTotal, setOrderTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const shipping = 280;
  const grandTotal = totalPrice + shipping;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // One UUID per checkout attempt. If the request is retried, times out, or
      // the page is refreshed and resubmitted, the server sees the same key and
      // returns the SAME order instead of creating a second one.
      const idempotencyKey =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          idempotencyKey,
          // price/total are intentionally NOT trusted by the server; it recalculates
          // every price from the database. They are omitted entirely.
          items: items.map(item => ({
            productId: item.productId,
            product: item.variant ? `${item.name} (${item.variant})` : item.name,
            name: item.name,
            variant: item.variant || undefined,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // The server's total is authoritative - show what it actually charged.
        // Prefer the short customer-facing number (1001) over the internal UUID.
        setOrderId(
          data.data?.orderNumber != null
            ? String(data.data.orderNumber)
            : (data.data?.id ?? '')
        );
        setOrderTotal(Number(data.data?.total) || 0);
        setOrderPlaced(true);
        clearCart();
      } else {
        alert(`Failed to place order: ${data.error || 'Please try again.'}`);
      }
    } catch (error) {
      console.error('Order error:', error);
      alert('Failed to place order. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border text-center p-8 space-y-6">
          <div className="text-6xl">✓</div>
          <h1 className="text-2xl font-bold text-foreground">Order Received!</h1>
          <p className="text-muted-foreground">
            Your order has been placed. Pay the advance on NayaPay and send us the
            screenshot on WhatsApp — your order is confirmed once the payment is
            received.
          </p>
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Order ID</p>
            <p className="text-lg font-bold text-foreground">{orderId}</p>
            <p className="text-sm text-muted-foreground mt-2 mb-1">Order Total</p>
            <p className="text-3xl font-bold text-accent">Rs {orderTotal.toLocaleString()}</p>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4 text-left text-sm text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">💳 Payment: NayaPay only — order NOT confirmed yet</p>
            <p>
              NayaPay Account Number:{" "}
              <span className="text-foreground font-semibold">{NAYAPAY_ACCOUNT_NUMBER}</span>
            </p>
            <p>
              Account Name:{" "}
              <span className="text-foreground font-semibold">{NAYAPAY_ACCOUNT_NAME}</span>
            </p>
            <p>1. Send the advance payment to the NayaPay account above.</p>
            <p>
              2. Send the payment screenshot on WhatsApp{" "}
              <span className="text-accent font-semibold">{HEROIX_WHATSAPP_DISPLAY}</span>.
            </p>
            <p>
              3. Once we receive your payment we will confirm your order on
              WhatsApp — only then does your order move forward.
            </p>
            <p className="text-foreground">
              ⚠️ Without payment your order will NOT be confirmed. No Cash on
              Delivery.
            </p>
          </div>
          <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
            <a
              href={HEROIX_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
            >
              Send Payment Screenshot on WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full border-border">
            <Link href="/">Continue Shopping</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/30 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Shop
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Shopping Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left - Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.length === 0 ? (
              <Card className="border-border p-8 text-center">
                <p className="text-muted-foreground mb-4">Your cart is empty</p>
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link href="/">Continue Shopping</Link>
                </Button>
              </Card>
            ) : (
              <>
                <h2 className="text-xl font-bold text-foreground mb-4">Order Items</h2>
                <div className="space-y-3">
                  {items.map(item => {
                    const itemKey = `${item.productId}-${item.variant || 'default'}`;
                    return (
                      <Card key={itemKey} className="border-border p-4 flex items-center gap-4">
                        {/* Placeholder for product image */}
                        <div className="w-20 h-20 bg-card/50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl">★</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground">{item.name}</h3>
                          {item.variant && (
                            <p className="text-xs text-accent font-medium mt-0.5">Design: {item.variant}</p>
                          )}
                          <p className="text-sm text-muted-foreground">Rs {item.price.toLocaleString()} each</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={typeof item.stock === 'number' && item.stock > 0 ? item.stock : undefined}
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 1, item.variant)}
                            className="w-12 px-2 py-1 bg-card/50 border border-border rounded text-foreground text-center"
                          />
                          <button
                            onClick={() => removeItem(item.productId, item.variant)}
                            className="p-2 text-muted-foreground hover:text-accent transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-accent">Rs {(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Right - Order Summary & Form */}
          <div className="space-y-6">
            {/* Order Summary */}
            <Card className="border-border p-6 space-y-4">
              <h3 className="font-bold text-foreground">Order Summary</h3>
              <div className="space-y-2 pb-4 border-b border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">Rs {totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping (PKR)</span>
                  <span className="text-foreground">Rs {shipping.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground">Total</span>
                <span className="text-2xl font-bold text-accent">
                  Rs {grandTotal.toLocaleString()}
                </span>
              </div>
            </Card>

            {/* Shipping Form */}
            <Card className="border-border p-6">
              <h3 className="font-bold text-foreground mb-4">Shipping Information</h3>
              <form onSubmit={handlePlaceOrder} className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                    placeholder="0300-1234567"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-1">City</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                    placeholder="Lahore"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Address</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-card/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                    placeholder="House #, Street #, Area"
                    rows={2}
                  />
                </div>

                <div className="bg-card/50 border border-accent/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground text-sm">
                    💳 Payment: NayaPay only ({NAYAPAY_ACCOUNT_NUMBER})
                  </p>
                  <p>
                    Account Name:{" "}
                    <span className="text-foreground font-semibold">{NAYAPAY_ACCOUNT_NAME}</span>
                  </p>
                  <p>
                    ⚠️ Your order will NOT be confirmed without payment. After you
                    place the order we contact you on WhatsApp{" "}
                    <span className="text-accent font-semibold">{HEROIX_WHATSAPP_DISPLAY}</span> -
                    once we receive your NayaPay payment, your order is confirmed on
                    WhatsApp and moves forward. No Cash on Delivery.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={items.length === 0 || isLoading}
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold disabled:opacity-50"
                >
                  {isLoading ? 'Placing Order...' : 'Place Order'}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
