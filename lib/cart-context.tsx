'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CartItem {
  productId: string;
  variant?: string; // Specific variant name if product has variants (e.g. "Classic Red")
  name: string;
  price: number;
  quantity: number;
  image: string;
  stock?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, variant?: string) => void;
  updateQuantity: (productId: string, quantity: number, variant?: string) => void;
  clearCart: () => void;
  totalPrice: number;
  totalItems: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Helper to determine if two items are identical (matching both productId and variant)
function isSameItem(a: CartItem, productId: string, variant?: string): boolean {
  if (a.productId !== productId) return false;
  const vA = (a.variant || '').trim().toLowerCase();
  const vB = (variant || '').trim().toLowerCase();
  return vA === vB;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (newItem: CartItem) => {
    setItems(prevItems => {
      // Never allow adding an out-of-stock item
      if (typeof newItem.stock === 'number' && newItem.stock <= 0) {
        return prevItems;
      }

      const existingIndex = prevItems.findIndex(item =>
        isSameItem(item, newItem.productId, newItem.variant)
      );

      if (existingIndex > -1) {
        return prevItems.map((item, idx) => {
          if (idx !== existingIndex) return item;
          // Cap quantity at the real stock level
          const cap = typeof item.stock === 'number' && item.stock > 0 ? item.stock : Infinity;
          return { ...item, quantity: Math.min(item.quantity + newItem.quantity, cap) };
        });
      }

      const cap = typeof newItem.stock === 'number' && newItem.stock > 0 ? newItem.stock : Infinity;
      return [...prevItems, { ...newItem, quantity: Math.min(newItem.quantity, cap) }];
    });
  };

  const removeItem = (productId: string, variant?: string) => {
    setItems(prevItems =>
      prevItems.filter(item => !isSameItem(item, productId, variant))
    );
  };

  const updateQuantity = (productId: string, quantity: number, variant?: string) => {
    if (quantity <= 0) {
      removeItem(productId, variant);
      return;
    }
    setItems(prevItems =>
      prevItems.map(item => {
        if (!isSameItem(item, productId, variant)) return item;
        // Never allow more than the real stock level
        const cap = typeof item.stock === 'number' && item.stock > 0 ? item.stock : Infinity;
        return { ...item, quantity: Math.min(quantity, cap) };
      })
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalPrice, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

