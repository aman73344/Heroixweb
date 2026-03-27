// Store configuration that chatbot reads dynamically
// This is editable from admin panel

export interface StoreConfig {
  store: {
    name: string;
    description: string;
    logo: string;
  };
  shipping: {
    coverage: string[];
    baseCost: number;
    deliveryDays: string;
    freeShippingAbove: number;
  };
  payment: {
    methods: string[];
    currencyCode: string;
    currencySymbol: string;
  };
  policies: {
    returnDays: number;
    exchangeDays: number;
    description: string;
  };
  contact: {
    whatsapp: string;
    instagram: string;
    email: string;
    phone: string;
  };
  features: {
    customOrdersAvailable: boolean;
    expressDeliveryAvailable: boolean;
  };
  faq: FAQ[];
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'shipping' | 'payment' | 'products' | 'returns' | 'general';
  keywords: string[];
}

// Default store configuration
export const defaultStoreConfig: StoreConfig = {
  store: {
    name: 'HEROIX',
    description: 'Premium anime, superhero, Marvel, DC & sports keychains',
    logo: '/heroix-logo.png',
  },
  shipping: {
    coverage: ['Karachi', 'Lahore', 'Islamabad', 'Multan', 'Peshawar', 'Quetta', 'All Pakistan'],
    baseCost: 250,
    deliveryDays: '5-7 business days',
    freeShippingAbove: 2000,
  },
  payment: {
    methods: ['Cash on Delivery', 'Bank Transfer', 'JazzCash', 'EasyPaisa'],
    currencyCode: 'PKR',
    currencySymbol: 'Rs',
  },
  policies: {
    returnDays: 7,
    exchangeDays: 10,
    description: 'Items can be returned within 7 days if unused. Exchanges available within 10 days.',
  },
  contact: {
    whatsapp: '+923001234567',
    instagram: '@heroix.keychains',
    email: 'hello@heroix.com',
    phone: '0300-1234567',
  },
  features: {
    customOrdersAvailable: true,
    expressDeliveryAvailable: false,
  },
  faq: [
    {
      id: 'faq-1',
      question: 'How much does shipping cost?',
      answer: 'Shipping cost is Rs 250 for all orders within Pakistan. Free shipping on orders above Rs 2000.',
      category: 'shipping',
      keywords: ['shipping', 'cost', 'price', 'delivery charge', 'postage'],
    },
    {
      id: 'faq-2',
      question: 'How long does delivery take?',
      answer: 'Standard delivery takes 5-7 business days across Pakistan. Orders are dispatched within 1-2 business days.',
      category: 'shipping',
      keywords: ['delivery', 'how long', 'time', 'days', 'when'],
    },
    {
      id: 'faq-3',
      question: 'What payment methods do you accept?',
      answer: 'We accept Cash on Delivery, Bank Transfer, JazzCash, and EasyPaisa. Choose your preferred method at checkout.',
      category: 'payment',
      keywords: ['payment', 'pay', 'method', 'card', 'bank', 'cash'],
    },
    {
      id: 'faq-4',
      question: 'Can I return or exchange a product?',
      answer: 'Yes! You can return items within 7 days if unused, or exchange within 10 days. Contact us with your order ID.',
      category: 'returns',
      keywords: ['return', 'exchange', 'refund', 'money back', 'wrong item'],
    },
    {
      id: 'faq-5',
      question: 'Do you offer custom keychains?',
      answer: 'Yes, we offer custom keychain orders! Contact us on WhatsApp (+923001234567) to discuss your design.',
      category: 'products',
      keywords: ['custom', 'personalized', 'make', 'design', 'bespoke'],
    },
    {
      id: 'faq-6',
      question: 'Are the keychains in stock?',
      answer: 'Most items are in stock and ready to ship. If an item is out of stock, we\'ll notify you immediately.',
      category: 'products',
      keywords: ['stock', 'available', 'in stock', 'out of stock'],
    },
    {
      id: 'faq-7',
      question: 'How can I track my order?',
      answer: 'You\'ll receive a tracking number via SMS/email after dispatch. You can also contact us for order status.',
      category: 'shipping',
      keywords: ['track', 'status', 'where', 'shipping number', 'tracking'],
    },
    {
      id: 'faq-8',
      question: 'What quality are the keychains?',
      answer: 'All HEROIX keychains are premium quality with detailed artwork, durable materials, and perfect for collectors or gifts.',
      category: 'products',
      keywords: ['quality', 'durable', 'materials', 'premium', 'good'],
    },
    {
      id: 'faq-9',
      question: 'Do you ship internationally?',
      answer: 'Currently, we ship within Pakistan only. International shipping may be available soon. Follow our Instagram for updates.',
      category: 'shipping',
      keywords: ['international', 'abroad', 'overseas', 'outside pakistan'],
    },
    {
      id: 'faq-10',
      question: 'How do I contact customer support?',
      answer: 'You can reach us via WhatsApp (+923001234567), Instagram (@heroix.keychains), email (hello@heroix.com), or phone (0300-1234567).',
      category: 'general',
      keywords: ['contact', 'support', 'help', 'email', 'phone', 'whatsapp'],
    },
  ],
};

// In-memory store config (in production, this would come from database)
let storeConfig: StoreConfig = { ...defaultStoreConfig };

export function getStoreConfig(): StoreConfig {
  return storeConfig;
}

export function updateStoreConfig(config: Partial<StoreConfig>): StoreConfig {
  storeConfig = { ...storeConfig, ...config };
  return storeConfig;
}

export function getShippingInfo(): string {
  const { baseCost, deliveryDays, freeShippingAbove } = storeConfig.shipping;
  const { currencySymbol } = storeConfig.payment;
  return `${currencySymbol} ${baseCost} (${deliveryDays}). Free shipping on orders above ${currencySymbol} ${freeShippingAbove}.`;
}

export function getFAQs(category?: string): FAQ[] {
  if (category) {
    return storeConfig.faq.filter(f => f.category === category);
  }
  return storeConfig.faq;
}

export function searchFAQ(query: string): FAQ | null {
  const lowerQuery = query.toLowerCase();
  return (
    storeConfig.faq.find(
      faq =>
        faq.question.toLowerCase().includes(lowerQuery) ||
        faq.answer.toLowerCase().includes(lowerQuery) ||
        faq.keywords.some(kw => lowerQuery.includes(kw) || kw.includes(lowerQuery))
    ) || null
  );
}
