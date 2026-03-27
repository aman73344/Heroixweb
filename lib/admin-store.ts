import { AdminOrder } from './orders-store';

export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  inStock: boolean;
  rating: number;
  reviews: number;
  stock: number;
  status: 'active' | 'draft' | 'archived';
}

export type { AdminOrder };

export const mockProducts: AdminProduct[] = [
  {
    id: 'neon-genesis',
    name: 'Neon Genesis Evangelion',
    description: 'Classic mecha anime keychain with iconic EVA Unit design',
    price: 599,
    category: 'Anime',
    image: '/placeholder-product.png',
    inStock: true,
    rating: 4.8,
    reviews: 342,
    stock: 50,
    status: 'active',
  },
  {
    id: 'attack-titan',
    name: 'Attack on Titan',
    description: 'Dynamic action keychain featuring the Scout Regiment emblem',
    price: 549,
    category: 'Anime',
    image: '/placeholder-product.png',
    inStock: true,
    rating: 4.9,
    reviews: 567,
    stock: 75,
    status: 'active',
  },
  {
    id: 'demon-slayer',
    name: 'Demon Slayer',
    description: 'Beautiful Demon Slayer Corps insignia keychain with sword charm',
    price: 649,
    category: 'Anime',
    image: '/placeholder-product.png',
    inStock: true,
    rating: 4.7,
    reviews: 421,
    stock: 60,
    status: 'active',
  },
  {
    id: 'jujutsu-kaisen',
    name: 'Jujutsu Kaisen',
    description: 'Cursed energy keychain featuring the Jujutsu High school emblem',
    price: 599,
    category: 'Anime',
    image: '/placeholder-product.png',
    inStock: true,
    rating: 4.8,
    reviews: 289,
    stock: 45,
    status: 'active',
  },
  {
    id: 'one-piece',
    name: 'One Piece',
    description: 'Straw hat pirates themed keychain with straw hat design',
    price: 699,
    category: 'Anime',
    image: '/placeholder-product.png',
    inStock: true,
    rating: 4.9,
    reviews: 734,
    stock: 80,
    status: 'active',
  },
  {
    id: 'naruto',
    name: 'Naruto',
    description: 'Hidden leaf village konoha keychain with leaf emblem',
    price: 549,
    category: 'Anime',
    image: '/placeholder-product.png',
    inStock: true,
    rating: 4.7,
    reviews: 523,
    stock: 65,
    status: 'active',
  },
];

export const mockOrders: AdminOrder[] = [
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
