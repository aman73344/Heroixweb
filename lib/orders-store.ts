// File-based persistence for orders (simulates database)
import fs from 'fs';
import path from 'path';

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
}

const DATA_FILE = path.join(process.cwd(), 'data', 'orders.json');

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load orders from file
export function loadOrders(): AdminOrder[] {
  try {
    ensureDataDir();
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading orders:', error);
  }
  // Return default orders if file doesn't exist
  return [
    {
      id: 'ORD-001',
      date: '2026-03-25',
      customer: 'Ahmed Khan',
      email: 'ahmed@example.com',
      phone: '0300-1234567',
      address: '123 Main St',
      city: 'Karachi',
      items: 2,
      total: 1398,
      status: 'shipped',
    },
    {
      id: 'ORD-002',
      date: '2026-03-24',
      customer: 'Fatima Ali',
      email: 'fatima@example.com',
      phone: '0300-7654321',
      address: '456 Oak Ave',
      city: 'Lahore',
      items: 1,
      total: 899,
      status: 'processing',
    },
    {
      id: 'ORD-003',
      date: '2026-03-23',
      customer: 'Ali Hassan',
      email: 'ali@example.com',
      phone: '0300-5555555',
      address: '789 Pine Rd',
      city: 'Islamabad',
      items: 3,
      total: 1847,
      status: 'pending',
    },
    {
      id: 'ORD-004',
      date: '2026-03-22',
      customer: 'Zainab Mohammad',
      email: 'zainab@example.com',
      phone: '0300-9999999',
      address: '321 Elm St',
      city: 'Multan',
      items: 1,
      total: 799,
      status: 'delivered',
    },
  ];
}

// Save orders to file
export function saveOrders(orders: AdminOrder[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
  } catch (error) {
    console.error('Error saving orders:', error);
  }
}

// In-memory orders that sync with file
let orders: AdminOrder[] = loadOrders();

export function getOrders(): AdminOrder[] {
  return orders;
}

export function addOrder(order: AdminOrder): void {
  orders.unshift(order);
  saveOrders(orders);
}

export function updateOrder(orderId: string, updates: Partial<AdminOrder>): AdminOrder | null {
  const index = orders.findIndex(o => o.id === orderId);
  if (index !== -1) {
    orders[index] = { ...orders[index], ...updates };
    saveOrders(orders);
    return orders[index];
  }
  return null;
}
