'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getStoreConfig, updateStoreConfig } from '@/lib/store-config';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SettingsPage() {
  const config = getStoreConfig();
  const [activeTab, setActiveTab] = useState('store');
  const [isSaving, setIsSaving] = useState(false);

  const [storeForm, setStoreForm] = useState({
    name: config.store.name,
    description: config.store.description,
    whatsapp: config.contact.whatsapp,
    instagram: config.contact.instagram,
    email: config.contact.email,
  });

  const [shippingForm, setShippingForm] = useState({
    baseCost: config.shipping.baseCost,
    deliveryDays: config.shipping.deliveryDays,
    freeShippingAbove: config.shipping.freeShippingAbove,
  });

  const [paymentMethods, setPaymentMethods] = useState(config.payment.methods);
  const [newMethod, setNewMethod] = useState('');

  async function handleSaveStore() {
    setIsSaving(true);
    try {
      updateStoreConfig({
        store: {
          ...config.store,
          name: storeForm.name,
          description: storeForm.description,
        },
        contact: {
          ...config.contact,
          whatsapp: storeForm.whatsapp,
          instagram: storeForm.instagram,
          email: storeForm.email,
        },
      });
      alert('Store settings saved!');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveShipping() {
    setIsSaving(true);
    try {
      updateStoreConfig({
        shipping: {
          ...config.shipping,
          baseCost: shippingForm.baseCost,
          deliveryDays: shippingForm.deliveryDays,
          freeShippingAbove: shippingForm.freeShippingAbove,
        },
      });
      alert('Shipping settings saved!');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Store Settings</h1>
        <p className="text-muted-foreground mt-2">Configure your store, shipping, and chatbot behavior</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-card/30 border border-border">
          <TabsTrigger value="store" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
            Store
          </TabsTrigger>
          <TabsTrigger value="shipping" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
            Shipping
          </TabsTrigger>
          <TabsTrigger value="payment" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
            Payment
          </TabsTrigger>
          <TabsTrigger value="faq" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
            FAQ
          </TabsTrigger>
        </TabsList>

        {/* Store Settings */}
        <TabsContent value="store" className="space-y-4">
          <Card className="p-6 border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">Store Information</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Store Name</label>
                <Input
                  value={storeForm.name}
                  onChange={e => setStoreForm({ ...storeForm, name: e.target.value })}
                  className="bg-background/50 border-border"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-2">Description</label>
                <textarea
                  value={storeForm.description}
                  onChange={e => setStoreForm({ ...storeForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="font-semibold text-foreground mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">WhatsApp</label>
                    <Input
                      value={storeForm.whatsapp}
                      onChange={e => setStoreForm({ ...storeForm, whatsapp: e.target.value })}
                      placeholder="+923001234567"
                      className="bg-background/50 border-border"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">Instagram</label>
                    <Input
                      value={storeForm.instagram}
                      onChange={e => setStoreForm({ ...storeForm, instagram: e.target.value })}
                      placeholder="@heroix.keychains"
                      className="bg-background/50 border-border"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-sm text-muted-foreground block mb-2">Email</label>
                    <Input
                      type="email"
                      value={storeForm.email}
                      onChange={e => setStoreForm({ ...storeForm, email: e.target.value })}
                      placeholder="hello@heroix.com"
                      className="bg-background/50 border-border"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  onClick={handleSaveStore}
                  disabled={isSaving}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Shipping Settings */}
        <TabsContent value="shipping" className="space-y-4">
          <Card className="p-6 border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">Shipping Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Base Shipping Cost (PKR)</label>
                <Input
                  type="number"
                  value={shippingForm.baseCost}
                  onChange={e => setShippingForm({ ...shippingForm, baseCost: parseInt(e.target.value) })}
                  className="bg-background/50 border-border"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-2">Estimated Delivery Time</label>
                <Input
                  value={shippingForm.deliveryDays}
                  onChange={e => setShippingForm({ ...shippingForm, deliveryDays: e.target.value })}
                  placeholder="e.g., 5-7 business days"
                  className="bg-background/50 border-border"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-2">Free Shipping Above (PKR)</label>
                <Input
                  type="number"
                  value={shippingForm.freeShippingAbove}
                  onChange={e => setShippingForm({ ...shippingForm, freeShippingAbove: parseInt(e.target.value) })}
                  className="bg-background/50 border-border"
                />
              </div>

              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Coverage:</strong> {config.shipping.coverage.join(', ')}
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  onClick={handleSaveShipping}
                  disabled={isSaving}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payment" className="space-y-4">
          <Card className="p-6 border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">Payment Methods</h2>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enabled payment methods:</p>
              <div className="space-y-2">
                {paymentMethods.map((method, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2 bg-card/50 rounded-lg border border-border">
                    <span className="text-foreground">{method}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPaymentMethods(paymentMethods.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:bg-red-500/10"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
                <Input
                  value={newMethod}
                  onChange={e => setNewMethod(e.target.value)}
                  placeholder="e.g., Credit Card"
                  className="bg-background/50 border-border"
                />
                <Button
                  onClick={() => {
                    if (newMethod && !paymentMethods.includes(newMethod)) {
                      setPaymentMethods([...paymentMethods, newMethod]);
                      setNewMethod('');
                    }
                  }}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  Add
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* FAQ Settings */}
        <TabsContent value="faq" className="space-y-4">
          <Card className="p-6 border-border">
            <h2 className="text-xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {config.faq.slice(0, 5).map(faq => (
                <div key={faq.id} className="p-4 border border-border rounded-lg space-y-2">
                  <p className="font-semibold text-foreground">{faq.question}</p>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                  <div className="flex gap-2 pt-2">
                    <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded">{faq.category}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">Total: {config.faq.length} FAQ entries</p>
          </Card>

          <Card className="p-6 border-border bg-blue-500/5 border-blue-500/20">
            <p className="text-sm text-blue-400">
              ℹ️ FAQ entries are automatically used by the chatbot to answer customer questions. Edit them from the code to add/remove FAQs.
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Chatbot Settings Info */}
      <Card className="p-6 border-border">
        <h2 className="text-xl font-bold text-foreground mb-4">Chatbot Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Intent Detection</p>
            <p className="font-semibold text-accent">Keyword Matching (Enabled)</p>
            <p className="text-xs text-muted-foreground mt-1">Classifies user messages into 12 intent types</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Session Management</p>
            <p className="font-semibold text-accent">Active</p>
            <p className="text-xs text-muted-foreground mt-1">Maintains conversation context across messages</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Order Processing</p>
            <p className="font-semibold text-accent">Enabled</p>
            <p className="text-xs text-muted-foreground mt-1">Collects order details progressively</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Product Search</p>
            <p className="font-semibold text-accent">Enabled</p>
            <p className="text-xs text-muted-foreground mt-1">Searches by name, category, and price range</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
