"use client";

import { Metadata } from "next";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCart } from "@/lib/cart-context";
import { SmartImage } from "@/components/smart-image";
import { IMAGE_SIZES } from "@/lib/image-url";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  NAYAPAY_ACCOUNT_NAME,
  NAYAPAY_ACCOUNT_NUMBER,
  HEROIX_WHATSAPP_DISPLAY,
  HEROIX_WHATSAPP_LINK,
  FREE_DELIVERY_MIN_ITEMS,
  deliveryCostFor,
  qualifiesForFreeDelivery,
  DELIVERY_BASE_COST,
} from "@/lib/store-config";

export const metadata: Metadata = {
  title: "Checkout - HEROIX Keychains",
  description: "Complete your order for premium anime, Marvel, DC & gaming keychains. 50% upfront via NayaPay, 50% after delivery. Ship across Pakistan.",
};

export default function CheckoutPage() {
  const { items, totalPrice, removeItem, updateQuantity, clearCart } =
    useCart();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [orderTotal, setOrderTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  

  // Total keychains in the cart (across every line/design).
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  // Free-delivery offer: 3+ keychains => Rs 0 delivery, otherwise the base cost.
  // Mirrors the authoritative server total in lib/order-pricing.ts exactly.
  const shipping = deliveryCostFor(itemCount);
  const freeDelivery = qualifiesForFreeDelivery(itemCount);
  const itemsAwayFromFreeDelivery = Math.max(
    0,
    FREE_DELIVERY_MIN_ITEMS - itemCount,
  );
  const grandTotal = totalPrice + shipping;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);

    try {
      // One UUID per checkout attempt. If the request is retried, times out, or
      // the page is refreshed and resubmitted, the server sees the same key and
      // returns the SAME order instead of creating a second one.
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          idempotencyKey,
          // price/total are intentionally NOT trusted by the server; it recalculates
          // every price from the database. They are omitted entirely.
          items: items.map((item) => ({
            productId: item.productId,
            product: item.variant
              ? `${item.name} (${item.variant})`
              : item.name,
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
            : (data.data?.id ?? ""),
        );
        setOrderTotal(Number(data.data?.total) || 0);
        setOrderPlaced(true);
        clearCart();
        // Tracking ID will be sent via WhatsApp after order confirmation
        // The order moves to "processing" status once 50% upfront payment is received
      } else {
        alert(`Failed to place order: ${data.error || "Please try again."}`);
      }
    } catch (error) {
      console.error("Order error:", error);
      alert(
        "Failed to place order. Please check your connection and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border text-center p-8 space-y-6">
          <div className="text-6xl">✓</div>
          <h1 className="text-2xl font-bold text-foreground">
            Order Received!
          </h1>
          <p className="text-muted-foreground">
            Your order has been placed. Pay 50% upfront via NayaPay and send us
            the screenshot on WhatsApp — your order is confirmed once the
            payment is received.
          </p>
          <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Order ID</p>
            <p className="text-lg font-bold text-foreground">{orderId}</p>
            <p className="text-sm text-muted-foreground mt-2 mb-1">
              Order Total
            </p>
            <p className="text-3xl font-bold text-accent">
              Rs {orderTotal.toLocaleString()}
            </p>
          </div>
          <div className="bg-card/50 border border-border rounded-lg p-4 text-left text-sm text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">
              💳 Payment: 50% upfront via NayaPay, 50% after delivery
            </p>
            <p>
              NayaPay Account Number:{" "}
              <span className="text-foreground font-semibold">
                {NAYAPAY_ACCOUNT_NUMBER}
              </span>
            </p>
            <p>
              Account Name:{" "}
              <span className="text-foreground font-semibold">
                {NAYAPAY_ACCOUNT_NAME}
              </span>
            </p>
            <p>1. Send 50% of the order total to the NayaPay account above.</p>
            <p>
              2. Send the payment screenshot on WhatsApp{" "}
              <span className="text-accent font-semibold">
                {HEROIX_WHATSAPP_DISPLAY}
              </span>
              .
            </p>
            <p>
              3. Once we receive your 50% upfront payment we confirm your order
              on WhatsApp — the remaining 50% is due after delivery.
            </p>
            <p className="text-foreground">
              ⚠️ Without the 50% upfront payment your order will not proceed. No
              Cash on Delivery.
            </p>
          </div>
          <Button
            asChild
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
          >
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
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/30 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Shop
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-8">
            Shopping Checkout
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left - Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.length === 0 ? (
                <Card className="border-border p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    Your cart is empty
                  </p>
                  <Button
                    asChild
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    <Link href="/">Continue Shopping</Link>
                  </Button>
                </Card>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-foreground mb-4">
                    Order Items
                  </h2>
                  <div className="space-y-3">
                    {items.map((item) => {
                      const itemKey = `${item.productId}-${item.variant || "default"}`;
                      return (
                        <Card
                          key={itemKey}
                          className="border-border p-4 flex items-center gap-4"
                        >
                          {/* Placeholder for product image */}
                          <div className="w-20 h-20 bg-card/50 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.image ? (
                              /* 80px line item - a thumbnail, not the original. */
                              <SmartImage
                                src={item.image}
                                cssWidth={80}
                                sizes={IMAGE_SIZES.cartLine}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-3xl">★</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-foreground">
                              {item.name}
                            </h3>
                            {item.variant && (
                              <p className="text-xs text-accent font-medium mt-0.5">
                                Design: {item.variant}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              Rs {item.price.toLocaleString()} each
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max={
                                typeof item.stock === "number" && item.stock > 0
                                  ? item.stock
                                  : undefined
                              }
                              value={item.quantity}
                              onChange={(e) =>
                                updateQuantity(
                                  item.productId,
                                  parseInt(e.target.value) || 1,
                                  item.variant,
                                )
                              }
                              className="w-12 px-2 py-1 bg-card/50 border border-border rounded text-foreground text-center"
                            />
                            <button
                              onClick={() =>
                                removeItem(item.productId, item.variant)
                              }
                              className="p-2 text-muted-foreground hover:text-accent transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="font-bold text-accent">
                              Rs {(item.price * item.quantity).toLocaleString()}
                            </p>
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

                {/* Free-delivery offer callout - roomy here on purpose: the
                  checkout has space, and this is where a one-item shopper is
                  most likely to add "just one more" to unlock free delivery. */}
                <div
                  className={`rounded-lg p-3 text-sm border ${
                    freeDelivery
                      ? "bg-accent/10 border-accent/40 text-foreground"
                      : "bg-card/50 border-border text-muted-foreground"
                  }`}
                >
                  {freeDelivery ? (
                    <p className="flex items-center gap-2 font-semibold text-foreground">
                      🎉 You&apos;ve unlocked{" "}
                      <span className="text-accent">FREE delivery!</span>
                    </p>
                  ) : (
                    <p>
                      Add{" "}
                      <span className="font-semibold text-foreground">
                        {itemsAwayFromFreeDelivery} more keychain
                        {itemsAwayFromFreeDelivery === 1 ? "" : "s"}
                      </span>{" "}
                      to get{" "}
                      <span className="font-semibold text-accent">
                        FREE delivery
                      </span>{" "}
                      (order {FREE_DELIVERY_MIN_ITEMS}+).
                    </p>
                  )}
                </div>

                <div className="space-y-2 pb-4 border-b border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">
                      Rs {totalPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Shipping (PKR)
                    </span>
                    {freeDelivery ? (
                      <span className="text-foreground">
                        <span className="line-through text-muted-foreground mr-2">
                          Rs {DELIVERY_BASE_COST.toLocaleString()}
                        </span>
                        <span className="font-semibold text-accent">FREE</span>
                      </span>
                    ) : (
                      <span className="text-foreground">
                        Rs {shipping.toLocaleString()}
                      </span>
                    )}
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
                <h3 className="font-bold text-foreground mb-4">
                  Shipping Information
                </h3>
                <form onSubmit={handlePlaceOrder} className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">
                      Full Name
                    </label>
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
                    <label className="text-sm text-muted-foreground block mb-1">
                      Email
                    </label>
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
                    <label className="text-sm text-muted-foreground block mb-1">
                      Phone
                    </label>
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
                    <label className="text-sm text-muted-foreground block mb-1">
                      City
                    </label>
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
                    <label className="text-sm text-muted-foreground block mb-1">
                      Address
                    </label>
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
{/* Payment Information - shown before order placement */}
              <Card className="border-border p-6">
                <h3 className="font-bold text-foreground mb-4">
                  Payment Details
                </h3>
                <p className="text-muted-foreground">
                  To secure your order, we require a 50% upfront payment via NayaPay. The remaining 50% is due after delivery. We'll contact you on WhatsApp ({HEROIX_WHATSAPP_DISPLAY}) after your order is placed to arrange payment.
                </p>
                <p className="font-medium text-accent mt-2">
                  NayaPay Account: {NAYAPAY_ACCOUNT_NUMBER} ({NAYAPAY_ACCOUNT_NAME})
                </p>
              </Card>

                  <Button
                    type="submit"
                    disabled={items.length === 0 || isLoading}
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold disabled:opacity-50"
                  >
                    {isLoading ? "Placing Order..." : "Place Order"}
                  </Button>
                </form>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Online-payment warning confirmation dialog */}
      {showPaymentWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Payment confirmation"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowPaymentWarning(false)}
          />
          <div className="relative bg-card p-6 rounded-xl border border-border shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-accent/10 text-accent rounded-lg p-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Online Payment Required
                </h3>
                <p className="text-sm text-muted-foreground">
                  HEROIX accepts NayaPay only — no Cash on Delivery.
                </p>
              </div>
            </div>

            <Card className="bg-accent/50 border-accent/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-foreground font-semibold mb-1">
                Send payment to:
              </p>
              <p className="text-sm text-accent-foreground font-bold">
                Account: {NAYAPAY_ACCOUNT_NUMBER}
              </p>
              <p className="text-sm text-foreground">
                Account Name: {NAYAPAY_ACCOUNT_NAME}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                After you send the 50% upfront payment we'll contact you on
                WhatsApp ({HEROIX_WHATSAPP_DISPLAY}) to confirm your order.
              </p>
            </Card>

            <p className="text-sm text-muted-foreground mb-6">
              By clicking “Yes, Continue” you confirm you understand that your
              order By clicking "Yes, Continue" you confirm you understand that
              your order will proceed once the 50% upfront NayaPay payment is
              received. The remaining 50% is due after delivery.
            </p>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPaymentWarning(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmPaymentWarning}
                disabled={isLoading}
                className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {isLoading ? "Placing Order..." : "Yes, Continue"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
