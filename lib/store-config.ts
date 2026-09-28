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

// ===== Payment details (single source of truth) =====
// HEROIX takes payments on NayaPay ONLY. An order is NOT confirmed until the
// payment has actually been received - our team contacts every customer on the
// official HEROIX WhatsApp number and confirms the order there.
export const NAYAPAY_ACCOUNT_NAME = 'Khawaja Aman Ali';
export const NAYAPAY_ACCOUNT_NUMBER = '03084824939';
export const HEROIX_WHATSAPP_DISPLAY = '+92 314 3131716';
export const HEROIX_WHATSAPP_LOCAL = '0314-3131716';
export const HEROIX_WHATSAPP_LINK = 'https://wa.me/923143131716';

// Short one-liner used in chats/UI
export function getPaymentInfo(): string {
  return `💳 NayaPay only — Account Number: ${NAYAPAY_ACCOUNT_NUMBER} | Account Name: ${NAYAPAY_ACCOUNT_NAME}`;
}

// The "order will not move without payment" notice
export function getOrderConfirmationNote(): string {
  return `⚠️ Your order is NOT confirmed until the payment is received. We will contact you on WhatsApp (${HEROIX_WHATSAPP_DISPLAY}) — once your NayaPay payment is received, your order is confirmed and moves forward.`;
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
    baseCost: 280,
    deliveryDays: '5-7 business days',
    freeShippingAbove: 2000,
  },
  payment: {
    methods: ['NayaPay'],
    currencyCode: 'PKR',
    currencySymbol: 'Rs',
  },
  policies: {
    returnDays: 0,
    exchangeDays: 0,
    description: 'No free returns. Please review product details carefully before ordering, or ask us on WhatsApp (03143131716) first.',
  },
  contact: {
    whatsapp: '+923143131716',
    instagram: '@heroix.keychains',
    email: 'hello@heroix.com',
    phone: '0314-3131716',
  },
  features: {
    customOrdersAvailable: true,
    expressDeliveryAvailable: false,
  },
  faq: [
    {
      id: 'faq-1',
      question: 'How much does shipping cost?',
      answer: 'Shipping (delivery charge) is Rs 280 for all orders within Pakistan.',
      category: 'shipping',
      keywords: ['shipping', 'cost', 'price', 'delivery charge', 'postage', 'dc'],
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
      answer: `We take payments on NayaPay only (no Cash on Delivery). NayaPay account number ${NAYAPAY_ACCOUNT_NUMBER} — account name ${NAYAPAY_ACCOUNT_NAME}. After you place the order we contact you on WhatsApp (${HEROIX_WHATSAPP_DISPLAY}). Your order is NOT confirmed until the payment is received — send the payment screenshot on WhatsApp and your order is confirmed and moves forward.`,
      category: 'payment',
      keywords: ['payment', 'pay', 'method', 'advance', 'nayapay', 'sadapay', 'online', 'transfer', 'screenshot', 'cash', 'account number', 'account name'],
    },
    {
      id: 'faq-4',
      question: 'Can I return or exchange a product?',
      answer: 'We do not offer free returns. Please review the product details carefully before ordering, or ask us on WhatsApp (03143131716) - we are happy to help before you buy.',
      category: 'returns',
      keywords: ['return', 'exchange', 'refund', 'money back', 'wrong item'],
    },
    {
      id: 'faq-5',
      question: 'Do you offer custom keychains?',
      answer: 'Yes, we offer custom keychain orders! Contact us on WhatsApp (03143131716) to discuss your design.',
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
      answer: 'You can reach us via WhatsApp (03143131716), Instagram (@heroix.keychains), email (hello@heroix.com), or phone (0314-3131716).',
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
  const { baseCost, deliveryDays } = storeConfig.shipping;
  const { currencySymbol } = storeConfig.payment;
  return `${currencySymbol} ${baseCost} delivery charge (${deliveryDays}) across Pakistan. Payment is NayaPay only (${NAYAPAY_ACCOUNT_NUMBER} - ${NAYAPAY_ACCOUNT_NAME}) - no Cash on Delivery.`;
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
