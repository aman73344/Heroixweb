// Server-side product storage for chatbot context
// This is separate from IndexedDB (client-side)
// Admin page will sync products to this file when adding/updating products

import fs from 'fs';
import path from 'path';

const PRODUCTS_FILE = path.join(process.cwd(), 'products.json');

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description?: string;
  images?: string[];
}

// Initialize empty products file if it doesn't exist
function ensureProductsFile() {
  if (!fs.existsSync(PRODUCTS_FILE)) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2));
  }
}

export function getServerProducts(): Product[] {
  try {
    ensureProductsFile();
    const data = fs.readFileSync(PRODUCTS_FILE, 'utf-8');
    const products = JSON.parse(data);
    return Array.isArray(products) ? products : [];
  } catch (error) {
    console.error('Error reading products from file:', error);
    return [];
  }
}

export function saveServerProducts(products: Product[]): boolean {
  try {
    ensureProductsFile();
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving products to file:', error);
    return false;
  }
}

export function addServerProduct(product: Product): boolean {
  try {
    const products = getServerProducts();
    const existingIndex = products.findIndex((p) => p.id === product.id);

    if (existingIndex >= 0) {
      products[existingIndex] = product;
    } else {
      products.push(product);
    }

    return saveServerProducts(products);
  } catch (error) {
    console.error('Error adding product:', error);
    return false;
  }
}

export function deleteServerProduct(productId: string): boolean {
  try {
    const products = getServerProducts();
    const filtered = products.filter((p) => p.id !== productId);
    return saveServerProducts(filtered);
  } catch (error) {
    console.error('Error deleting product:', error);
    return false;
  }
}

export function getFormattedProductsForChatbot(): string {
  try {
    const products = getServerProducts();
    if (products.length === 0) {
      return 'No products available currently.';
    }

    const productList = products
      .slice(0, 20)
      .map(
        (p) => `${p.name} (${p.category}): Rs ${p.price}, Stock: ${p.stock}${p.description ? ` - ${p.description}` : ''}`,
      )
      .join('\n');

    return productList;
  } catch (error) {
    console.error('Error formatting products:', error);
    return 'Product catalog unavailable.';
  }
}
