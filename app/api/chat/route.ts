import { NextRequest, NextResponse } from 'next/server';
import { generateLLMResponse, ChatMessage } from '@/lib/llm';
import { getServerProducts } from '@/lib/server-products';
import { addOrderIdempotent, AdminOrder } from '@/lib/orders-store';
import { reserveStock, releaseStock } from '@/lib/db';
import { priceOrderFromDatabase } from '@/lib/order-pricing';
import { NAYAPAY_ACCOUNT_NAME, NAYAPAY_ACCOUNT_NUMBER, HEROIX_WHATSAPP_DISPLAY } from '@/lib/store-config';
import { normalizeRating } from '@/lib/reviews';
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface OrderItem {
  product: string;
  productId: string;
  quantity: number;
  price: number;
}

interface SessionState {
  orderState: {
    items: OrderItem[];
    name?: string;
    phone?: string;
    city?: string;
    address?: string;
    confirmed?: boolean;
  };
  lastAssistantMessage?: string;
  orderStep?: string;
  mentionedProducts?: string[];
  lastUserMessage?: string;
}

const sessions = new Map<string, SessionState>();
const conversations = new Map<string, ChatMessage[]>();

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// The in-progress order lives in memory, which is wiped whenever the server
// restarts (including every dev hot-reload). Mirroring it into a cookie means a
// customer never loses the order they just typed in and no order is dropped
// half way through the flow.
const CHAT_STATE_COOKIE = 'heroix_chat_state';

function encodeChatState(state: SessionState): string {
  try {
    return encodeURIComponent(
      JSON.stringify({ orderState: state.orderState, orderStep: state.orderStep })
    );
  } catch {
    return '';
  }
}

function parseChatState(value: string): SessionState | null {
  try {
    const parsed = JSON.parse(value);
    if (parsed && parsed.orderState && Array.isArray(parsed.orderState.items)) {
      return { orderState: parsed.orderState, orderStep: parsed.orderStep } as SessionState;
    }
  } catch {
    // ignore malformed state
  }
  return null;
}

function decodeChatState(raw?: string | null): SessionState | null {
  if (!raw) return null;
  try {
    // Next decodes the cookie once, so try both the raw and the decoded value.
    return parseChatState(decodeURIComponent(raw)) || parseChatState(raw);
  } catch {
    return parseChatState(raw);
  }
}

const FALLBACK_PRODUCTS = [
  { id: 'neon-genesis', name: 'Neon Genesis Evangelion', category: 'Anime', price: 599, rating: 4.8 },
  { id: 'attack-titan', name: 'Attack on Titan', category: 'Anime', price: 549, rating: 4.9 },
  { id: 'demon-slayer', name: 'Demon Slayer', category: 'Anime', price: 649, rating: 4.7 },
  { id: 'jujutsu-kaisen', name: 'Jujutsu Kaisen', category: 'Anime', price: 599, rating: 4.8 },
  { id: 'naruto', name: 'Naruto', category: 'Anime', price: 549, rating: 4.7 },
  { id: 'one-piece', name: 'One Piece', category: 'Anime', price: 699, rating: 4.9 },
  { id: 'dragon-ball', name: 'Dragon Ball Z Goku', category: 'Anime', price: 599, rating: 4.8 },
  { id: 'batman', name: 'Batman Icon', category: 'Superhero', price: 599, rating: 4.8 },
  { id: 'batman-batarang', name: 'Batman Batarang', category: 'Superhero', price: 550, rating: 4.7 },
  { id: 'superman', name: 'Superman Shield', category: 'Superhero', price: 599, rating: 4.7 },
  { id: 'wonder-woman', name: 'Wonder Woman Lasso', category: 'Superhero', price: 649, rating: 4.9 },
  { id: 'iron-man', name: 'Iron Man Arc Reactor', category: 'Marvel', price: 699, rating: 4.9 },
  { id: 'spider-man', name: 'Spider-Man Web', category: 'Marvel', price: 549, rating: 4.8 },
  { id: 'spiderman-spinning', name: 'Spider-Man Spinning', category: 'Marvel', price: 500, rating: 4.6 },
  { id: 'thor-hammer', name: 'Thor Mjolnir', category: 'Marvel', price: 749, rating: 4.9 },
  { id: 'flash', name: 'The Flash Lightning', category: 'DC', price: 549, rating: 4.7 },
  { id: 'aquaman', name: 'Aquaman Trident', category: 'DC', price: 599, rating: 4.6 },
  { id: 'ronaldo-7', name: 'Cristiano Ronaldo CR7', category: 'Sports', price: 499, rating: 4.8 },
  { id: 'messi-10', name: 'Lionel Messi 10', category: 'Sports', price: 499, rating: 4.9 },
  { id: 'football-trophy', name: 'Football Trophy', category: 'Sports', price: 449, rating: 4.5 },
];

async function getProductContext(): Promise<any[]> {
  try {
    const products = await getServerProducts();
    if (products && products.length > 0) {
      return products.map(p => ({
        id: p.id || p.name,
        name: p.name,
        category: p.category,
        price: p.price,
        description: p.description || p.name,
        rating: normalizeRating(p.rating),
        ...(p.stock !== null && p.stock !== undefined
          ? { stock: Number(p.stock) || 0 }
          : {})
      }));
    }
  } catch {
    console.warn('Using fallback products');
  }
  return FALLBACK_PRODUCTS;
}

function getOrCreateSession(sessionId: string): SessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { orderState: { items: [] } });
  }
  return sessions.get(sessionId)!;
}

function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findProductsInMessage(
  userMessage: string,
  products: any[],
  sessionState?: SessionState
): Array<{id: string; name: string; price: number; matchType: 'exact' | 'partial' | 'alias'}> {
  const lower = normalizeText(userMessage);
  const found: Array<{id: string; name: string; price: number; matchType: 'exact' | 'partial' | 'alias'}> = [];
  
  const validProducts = products.filter(p => p && p.name && typeof p.name === 'string');
  
  const onlyThesePatterns = /only these|just these|only this|only these ones|bas yeh|bas yehi|sirf yeh|only want|only these 3|these three|these ones/i;
  
  if (onlyThesePatterns.test(lower) && sessionState?.mentionedProducts?.length) {
    for (const mentioned of sessionState.mentionedProducts) {
      const match = validProducts.find(p => 
        normalizeText(p.name).includes(normalizeText(mentioned)) ||
        normalizeText(mentioned).includes(normalizeText(p.name))
      );
      if (match && !found.find(f => f.id === match.id)) {
        found.push({ id: match.id, name: match.name, price: match.price || 0, matchType: 'exact' });
      }
    }
    return found;
  }
  
  const exactProductAliases: Record<string, string> = {
    'goku': 'goku super sayian',
    'gou': 'goku super sayian',
    'dragon ball': 'dragon ball z goku',
    'dbz': 'dragon ball z goku',
    'super saiyan': 'goku super sayian',
    'naruto': 'naruto',
    'luffy': 'one piece',
    'zoro': 'one piece',
    'spiderman spinning': 'spiderman spinning',
    'spinning': 'spiderman spinning',
    'spiderman web': 'spiderman web',
    'batman batarang': 'batman batarang',
    'batarang': 'batman batarang',
    'batrang': 'batman batarang',
    'batman batrang': 'batman batarang',
    'batman icon': 'batman icon',
    'batman logo': 'batman icon',
    'iron man': 'iron man arc reactor',
    'ironman': 'iron man arc reactor',
    'arc reactor': 'iron man arc reactor',
    'thor mjolnir': 'thor mjolnir',
    'thor hammer': 'thor mjolnir',
    'superman shield': 'superman shield',
    'superman': 'superman shield',
    'wonder woman lasso': 'wonder woman lasso',
    'wonder woman': 'wonder woman lasso',
    'aquaman trident': 'aquaman trident',
    'aquaman': 'aquaman trident',
    'the flash lightning': 'the flash lightning',
    'flash lightning': 'the flash lightning',
    'cristiano ronaldo cr7': 'cristiano ronaldo cr7',
    'ronaldo': 'cristiano ronaldo cr7',
    'cr7': 'cristiano ronaldo cr7',
    'lionel messi 10': 'lionel messi 10',
    'messi': 'lionel messi 10',
    'football trophy': 'football trophy',
    'football': 'football trophy',
    'neon genesis evangelion': 'neon genesis evangelion',
    'evangelion': 'neon genesis evangelion',
    'attack on titan': 'attack on titan',
    'aot': 'attack on titan',
    'demon slayer': 'demon slayer',
    'jujutsu kaisen': 'jujutsu kaisen',
    'jujutsu': 'jujutsu kaisen',
  };
  
  const matchedProductNames = new Set<string>();
  
  for (const [alias, productName] of Object.entries(exactProductAliases)) {
    if (lower.includes(alias)) {
      matchedProductNames.add(productName);
    }
  }
  
  for (const product of validProducts) {
    if (!product.name) continue;
    
    const productNameLower = normalizeText(product.name);
    
    if (lower.includes(productNameLower)) {
      matchedProductNames.add(productNameLower);
    }
  }
  
  for (const product of validProducts) {
    if (!product.name) continue;
    
    const productNameLower = normalizeText(product.name);
    
    if (matchedProductNames.has(productNameLower)) {
      if (!found.find(p => p.id === product.id)) {
        found.push({ id: product.id, name: product.name, price: product.price || 0, matchType: 'exact' });
      }
    }
  }
  
  return found;
}

function trackMentionedProducts(userMessage: string, products: any[], sessionState: SessionState) {
  const found = findProductsInMessage(userMessage, products, sessionState);
  
  if (found.length > 0) {
    if (!sessionState.mentionedProducts) {
      sessionState.mentionedProducts = [];
    }
    
    for (const product of found) {
      if (!sessionState.mentionedProducts.includes(product.name)) {
        sessionState.mentionedProducts.push(product.name);
      }
    }
    
    if (sessionState.mentionedProducts.length > 10) {
      sessionState.mentionedProducts = sessionState.mentionedProducts.slice(-10);
    }
  }
}

function extractQuantitiesForProducts(
  userMessage: string,
  productNames: string[]
): Map<string, number> {
  const quantities = new Map<string, number>();

  for (const name of productNames) {
    const nameLower = name.toLowerCase();
    const patterns = [
      new RegExp(`(\\d+)\\s+(?:x|×)?\\s*(${nameLower})`, 'i'),
      new RegExp(`(${nameLower})\\s*(?:x|×)?\\s*(\\d+)`, 'i'),
      new RegExp(`(${nameLower}).*?(\\d+)\\s*(?:pieces?|pcs?)`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = userMessage.match(pattern);
      if (match) {
        const qty = parseInt(match[2] || match[1]);
        if (qty > 0 && qty <= 100) {
          quantities.set(name, qty);
          break;
        }
      }
    }
  }
  
  return quantities;
}

function extractName(lower: string, trimmed: string, currentStep?: string): string | undefined {
  if (currentStep === 'name') {
    const explicitMatch = trimmed.match(/(?:name|naam|mera naam|my name is)\s*[:\-]?\s*(.+)/i);
    if (explicitMatch) {
      return explicitMatch[1].trim().split(/\s+/).slice(0, 3).join(' ');
    }
    const words = trimmed.split(/\s+/).slice(0, 3);
    const validWords = words.filter((w: string) => 
      w.length >= 2 && 
      /^[a-zA-Z]+$/.test(w) &&
      !['order', 'want', 'need', 'please', 'thanks', 'thank', 'yes', 'no', 'confirm'].includes(w.toLowerCase())
    );
    if (validWords.length > 0) {
      return validWords.join(' ');
    }
  }
  
  const explicitNamePattern = /(?:name|naam|mera naam|my name is|naam hai|mere name)\s*[:\-]?\s*([a-zA-Z\s]+?)(?:\s*,|\s*\d|\s*\n|$)/i;
  const match = lower.match(explicitNamePattern);
  if (match) {
    return match[1].trim().split(/\s+/).slice(0, 3).join(' ');
  }
  
  return undefined;
}

function extractPhone(userMessage: string): string | undefined {
  const patterns = [
    /(\d{4}[\s\-]?\d{7})/,
    /(\d{11})/,
    /(\+92\s?\d{3}[\s\-]?\d{7})/,
    /0\d{3}[\s\-]?\d{7}/,
  ];
  for (const pattern of patterns) {
    const match = userMessage.match(pattern);
    if (match) {
      return match[0].replace(/[\s\-\+]/g, '');
    }
  }
  return undefined;
}

function extractCity(lower: string): string | undefined {
  const cities = ['lahore', 'karachi', 'islamabad', 'peshawar', 'quetta', 'multan', 'faisalabad', 'rawalpindi', 'hyderabad', 'sialkot', 'gujranwala'];
  for (const city of cities) {
    if (lower.includes(city)) {
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  return undefined;
}

function extractAddress(userMessage: string): string | undefined {
  const match = userMessage.match(/(?:address|rahe|street|house|flat|building)\s*[:\-]?\s*(.+)/i);
  if (match) {
    return match[1].trim();
  }
  return undefined;
}

function formatOrderSummary(
  orderState: SessionState['orderState'],
  shipping: number = 280
): { text: string; subtotal: number; total: number } {
  let subtotal = 0;
  let itemsText = '';
  
  for (const item of orderState.items) {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    itemsText += `• ${item.product || 'Unknown'} x${item.quantity} = Rs ${itemTotal}\n`;
  }
  
  const total = subtotal + shipping;
  
  const text = `📋 Order Summary:\n\n${itemsText}• Shipping = Rs ${shipping}\n• Total = Rs ${total}\n\n💳 Payment: NayaPay only\nAccount Number: ${NAYAPAY_ACCOUNT_NUMBER}\nAccount Name: ${NAYAPAY_ACCOUNT_NAME}\n\n⚠️ Your order will NOT be confirmed without payment. Pay the advance on NayaPay and send the screenshot on WhatsApp (${HEROIX_WHATSAPP_DISPLAY}) — once the payment is received your order is confirmed and moves forward.\n\n📍 Delivery to:\n${orderState.name || 'N/A'}\n${orderState.city || 'N/A'}\n${orderState.address || 'N/A'}\n📱 Phone: ${orderState.phone || 'N/A'}\n\nReply "yes" to confirm or "cancel" to start over.`;
  
  return { text, subtotal, total };
}

async function handleOrderFlow(
  sessionState: SessionState,
  userMessage: string,
  products: any[]
): Promise<string | null> {
  const { orderState } = sessionState;
  const lower = userMessage.toLowerCase();
  const trimmed = userMessage.trim();
  
  if (lower.includes('cancel') || lower.includes('band karo')) {
    sessionState.orderState = { items: [] };
    sessionState.orderStep = undefined;
    return "Order cancelled. What else can I help you with?";
  }
  
  if (orderState.confirmed === false && (lower.includes('yes') || lower.includes('confirm') || lower.includes('haan') || lower.includes('ha'))) {
    orderState.confirmed = true;

    if (!orderState.name || orderState.name === 'Unknown') {
      sessionState.orderStep = 'name';
      return `I need your name to place the order. What's your name please?`;
    }
    
    if (!orderState.phone) {
      sessionState.orderStep = 'phone';
      return `Thanks ${orderState.name}! What's your phone number?`;
    }
    
    if (!orderState.city) {
      sessionState.orderStep = 'city';
      return `Which city should we deliver to?`;
    }
    
    if (!orderState.address) {
      sessionState.orderStep = 'address';
      return `What's your full delivery address?`;
    }
    
    // Order ids are UUIDs generated here, never Date.now() (which collided when
    // two chat sessions confirmed in the same millisecond).
    const orderId = crypto.randomUUID();

    // ---- TRUSTED PRICING ---------------------------------------------------
    // The prices held in the chat session were read from the catalogue earlier in
    // the conversation and could be stale. They are recomputed from the database
    // at confirmation time, so nothing price-related is trusted from the session.
    let priced;
    try {
      priced = await priceOrderFromDatabase(
        orderState.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      );
    } catch (error: any) {
      console.error('Chat order pricing failed:', error);
      return `⚠️ I could not load the current prices for your order (${error?.message || 'please try again'}).\n\nNothing has been charged or reserved. Please try again in a moment or contact us on WhatsApp (${HEROIX_WHATSAPP_DISPLAY}).`;
    }

    const totalItems = priced.itemCount;
    const total = priced.total;
    const itemsList = priced.items
      .map((i) => `${i.quantity}x ${i.product}`)
      .join(', ');

    // ---- ATOMIC STOCK RESERVATION -----------------------------------------
    // Same contract as POST /api/orders: reserve every line, and if any line
    // fails the whole reservation is rolled back inside reserveStock and no
    // order is created. `variant` is passed through so a design-specific line
    // reserves against the same stock the checkout route reserves against.
    const reservation = await reserveStock(
      priced.items.map((i) => ({ productId: i.productId, quantity: i.quantity, variant: i.variant }))
    );

    if (!reservation.ok) {
      const details = reservation.failures
        .map((f) => {
          const item = priced.items.find((i) => i.productId === f.productId);
          return `"${item ? item.product : 'An item'}" has ${f.available} left (you asked for ${f.requested})`;
        })
        .join('; ');
      return `⚠️ Sorry, insufficient stock: ${details}.\n\nPlease reduce the quantity or choose another keychain, then reply "yes" to confirm again.`;
    }

    const newOrder: AdminOrder = {
      id: orderId,
      date: new Date().toISOString().split('T')[0],
      customer: orderState.name,
      email: '',
      phone: orderState.phone,
      address: orderState.address,
      city: orderState.city,
      items: totalItems,
      total,
      status: 'pending',
      items_data: priced.items.map((i) => ({
        product: i.product,
        productId: i.productId,
        variant: i.variant,
        price: i.price,
        quantity: i.quantity,
      })),
    };

    // Idempotent insert. There is deliberately NO blind retry here: the previous
    // code retried the insert once, which created a duplicate order whenever the
    // first insert had actually succeeded but the response was lost.
    const result = await addOrderIdempotent(newOrder);

    if (!result.saved) {
      // Releases `reservation.reserved` - exactly the lines this call actually
      // decremented - rather than re-deriving them from the priced items, which
      // would credit back stock for lines that were never taken.
      await releaseStock(reservation.reserved);
      console.error('Chat order could NOT be saved:', newOrder.id);
      return `⚠️ There was an issue saving your order. Please try again or contact support on WhatsApp (${HEROIX_WHATSAPP_DISPLAY}).\n\nNothing has been charged.`;
    }

    if (result.duplicate) {
      await releaseStock(reservation.reserved);
    }

    console.log('Chat order saved:', newOrder.id, '| total: Rs', total);

    // Clear the session so a repeated "yes" cannot create a second order.
    sessionState.orderState = { items: [] };
    sessionState.orderStep = undefined;

    return `🎉 Order received!\n\n📦 Order: ${itemsList}\n💰 Total: Rs ${total}\n📍 Delivery to: ${orderState.city}\n\n🆔 Order ID: ${newOrder.id}\n\n💳 Payment: NayaPay only\nAccount Number: ${NAYAPAY_ACCOUNT_NUMBER}\nAccount Name: ${NAYAPAY_ACCOUNT_NAME}\n\n⚠️ Your order is NOT confirmed yet — without payment the order will not move forward. Send your payment screenshot on WhatsApp (${HEROIX_WHATSAPP_DISPLAY}); once we receive your NayaPay payment we will confirm your order on WhatsApp and it will move forward.\n\nThanks for shopping with HEROIX!`;
  }

  const onlyThesePatterns = /only these|just these|only these 3|only this|only these ones|bas yeh|bas yehi|sirf yeh|only want these|only these ones|these three|these ones/i;
  const alsoAddPatterns = /^(also add|add also|and also|add karo|bhi|aur add|add bhi)/i;
  const excludePatterns = /exclude|remove|not want|don't want|without|nahi chahiye|nahi lena/i;
  
  let foundProducts: Array<{id: string; name: string; price: number; matchType: 'exact' | 'partial' | 'alias'}> = [];
  
  if (excludePatterns.test(lower) && orderState.items.length > 0) {
    const normalizedLower = normalizeText(lower);
    const excludeWords = normalizedLower.split(' ').filter(w => w.length >= 3);
    
    const excludedItems = orderState.items.filter(item => {
      const itemNorm = normalizeText(item.product);
      return excludeWords.some(word => itemNorm.includes(word) || word.includes(itemNorm.split(' ')[0]));
    });
    
    if (excludedItems.length > 0) {
      for (const excluded of excludedItems) {
        orderState.items = orderState.items.filter(i => i.product !== excluded.product);
      }
      
      if (orderState.items.length === 0) {
        orderState.items = [];
        sessionState.orderStep = 'product';
        return "No problem! Which keychains would you like to order?";
      }
      
      if (orderState.items.length === 1 && orderState.items[0].quantity === 0) {
        sessionState.orderStep = `qty_${orderState.items[0].product.split(' ')[0].toLowerCase()}`;
        return `Got it! Just ${orderState.items[0].product}. How many do you need?`;
      }
      
      const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
      if (itemsNeedingQty.length > 0) {
        sessionState.orderStep = 'qty_all';
        const itemList = orderState.items.map((item, idx) => `${idx + 1}. ${item.product}`).join(', ');
        return `Updated! You want: ${itemList}. Please tell me the quantity for each:`;
      }
      
      const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product}`).join(', ');
      sessionState.orderStep = 'name';
      return `Got it! Your order: ${itemsList}. What's your name?`;
    }
  }
  
  foundProducts = findProductsInMessage(userMessage, products, sessionState);
  
  if (foundProducts.length > 0) {
    const quantities = extractQuantitiesForProducts(userMessage, foundProducts.map(p => p.name));
    
    const isAlsoAdd = alsoAddPatterns.test(lower) && orderState.items.length > 0 && !onlyThesePatterns.test(lower);
    
    if (!isAlsoAdd && !onlyThesePatterns.test(lower)) {
      orderState.items = [];
    }
    
    const currentProducts = foundProducts;
    
    if (lower.match(/^\d+([,\/]\d+)*$/) && foundProducts.length > 0) {
      const parts = lower.split(/[,\/]/);
      let idx = 0;
      for (const found of foundProducts) {
        if (idx < parts.length) {
          const qty = parseInt(parts[idx]);
          if (qty > 0 && qty <= 100) {
            const existingIndex = orderState.items.findIndex(i => i.productId === found.id);
            if (existingIndex >= 0) {
              orderState.items[existingIndex].quantity = qty;
            } else {
              orderState.items.push({
                product: found.name,
                productId: found.id,
                price: found.price,
                quantity: qty
              });
            }
          }
          idx++;
        }
      }
      
      const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
      if (itemsNeedingQty.length === 0) {
        sessionState.orderStep = 'name';
        const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product}`).join(', ');
        return `Perfect! Your order: ${itemsList}. What's your name?`;
      }
    }
    
    const confirmedItems = orderState.items.filter(i => i.quantity > 0);
    orderState.items = [...confirmedItems];
    
    for (const found of currentProducts) {
      const existingIndex = orderState.items.findIndex(i => i.productId === found.id);
      const qty = quantities.get(found.name) || 0;
      
      if (existingIndex >= 0) {
        if (qty > 0) orderState.items[existingIndex].quantity = qty;
      } else {
        orderState.items.push({
          product: found.name || 'Unknown Product',
          productId: found.id || `prod_${Date.now()}`,
          price: found.price || 0,
          quantity: qty
        });
      }
    }
    
    const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
    
    if (itemsNeedingQty.length > 0) {
      if (itemsNeedingQty.length === 1) {
        const currentItem = itemsNeedingQty[0];
        sessionState.orderStep = `qty_${currentItem.product.split(' ')[0].toLowerCase()}`;
        return `Got it! You want ${currentItem.product}. How many do you need?`;
      }
      
      sessionState.orderStep = 'qty_all';
      const itemList = itemsNeedingQty.map((item, idx) => `${idx + 1}. ${item.product}`).join(', ');
      return `Great choices! How many of each?\n${itemList}\n\n(Example: "1 for spiderman, 1 for batman, 1 for goku")`;
    }
    
    sessionState.orderStep = 'name';
    const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product || 'Unknown'}`).join(', ');
    return `Perfect! Your order: ${itemsList}. What's your name?`;
  }
  
  if (sessionState.orderStep === 'qty_all') {
    const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
    if (itemsNeedingQty.length > 0) {
      
      if (lower.match(/^\d+([,\/]\d+)*$/) || lower.match(/^\d+\s+\d+\s+\d+$/)) {
        const parts = lower.split(/[,\/\s]+/).filter(p => p.match(/^\d+$/));
        let idx = 0;
        for (const item of itemsNeedingQty) {
          if (idx < parts.length) {
            const qty = parseInt(parts[idx]);
            if (qty > 0 && qty <= 100) {
              item.quantity = qty;
            }
            idx++;
          }
        }
        
        const stillNeedQty = itemsNeedingQty.filter(i => i.quantity === 0);
        if (stillNeedQty.length === 0) {
          sessionState.orderStep = 'name';
          const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product}`).join(', ');
          return `Perfect! Your order: ${itemsList}. What's your name?`;
        }
      }
      
      let allHaveQty = true;
      
      for (const item of itemsNeedingQty) {
        if (item.quantity > 0) continue;
        
        const firstWord = item.product.split(' ')[0].toLowerCase();
        const patterns = [
          new RegExp(`(\\d+)\\s+(?:x|×)?\\s*(?:for|of)?\\s*${firstWord}`, 'i'),
          new RegExp(`${firstWord}.*?:\\s*(\\d+)`, 'i'),
          new RegExp(`(\\d+)\\s+${firstWord}`, 'i'),
        ];
        
        let foundQty = 0;
        for (const pattern of patterns) {
          const match = lower.match(pattern);
          if (match) {
            foundQty = parseInt(match[1]);
            if (foundQty > 0 && foundQty <= 100) break;
          }
        }
        
        if (foundQty === 0) {
          const numbers = trimmed.match(/\d+/g);
          if (numbers && numbers.length >= itemsNeedingQty.length) {
            const itemIndex = itemsNeedingQty.indexOf(item);
            foundQty = parseInt(numbers[itemIndex]);
          }
        }
        
        if (foundQty > 0) {
          item.quantity = foundQty;
        } else {
          allHaveQty = false;
        }
      }
      
      if (allHaveQty) {
        sessionState.orderStep = 'name';
        const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product || 'Unknown'}`).join(', ');
        return `Perfect! Your order: ${itemsList}. What's your name?`;
      }
      
      const remainingItems = itemsNeedingQty.filter(i => i.quantity === 0);
      if (remainingItems.length === 1) {
        sessionState.orderStep = `qty_${remainingItems[0].product.split(' ')[0].toLowerCase()}`;
        return `How many ${remainingItems[0].product} do you need?`;
      }
      
      const itemList = remainingItems.map((item, idx) => `${idx + 1}. ${item.product}`).join(', ');
      return `Please specify quantities for: ${itemList}`;
    }
  }
  
  if (sessionState.orderStep?.startsWith('qty_')) {
    const productName = sessionState.orderStep.replace('qty_', '');
    const item = orderState.items.find(i => i.product.toLowerCase().includes(productName));
    
    if (item) {
      const qtyMatch = trimmed.match(/\d+/);
      if (qtyMatch) {
        const qty = parseInt(qtyMatch[0]);
        if (qty > 0 && qty <= 100) {
          item.quantity = qty;
          
          const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
          
          if (itemsNeedingQty.length > 0) {
            const nextItem = itemsNeedingQty[0];
            sessionState.orderStep = `qty_${nextItem.product.split(' ')[0].toLowerCase()}`;

            return `Got it! ${qty}x ${item.product}. Now how many ${nextItem.product}?`;
          }
          
          sessionState.orderStep = 'name';
          const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product || 'Unknown'}`).join(', ');
          return `Perfect! Your order: ${itemsList}. What's your name?`;
        }
      }
      if (/one|single/i.test(trimmed)) {
        item.quantity = 1;
        const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
        
        if (itemsNeedingQty.length > 0) {
          const nextItem = itemsNeedingQty[0];
          sessionState.orderStep = `qty_${nextItem.product.split(' ')[0].toLowerCase()}`;
          return `Got it! 1x ${item.product}. Now how many ${nextItem.product}?`;
        }
        
        sessionState.orderStep = 'name';
        const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product || 'Unknown'}`).join(', ');
        return `Perfect! Your order: ${itemsList}. What's your name?`;
      }
      return `Please tell me how many ${item.product} you need (e.g., 1, 2, 3...)`;
    }
  }
  
  const extractedName = extractName(lower, trimmed, sessionState.orderStep);
  if (extractedName) {
    orderState.name = extractedName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  
  const extractedPhone = extractPhone(userMessage);
  if (extractedPhone) {
    orderState.phone = extractedPhone;
  }
  
  const extractedCity = extractCity(lower);
  if (extractedCity) {
    orderState.city = extractedCity;
  }
  
  const extractedAddress = extractAddress(userMessage);
  if (extractedAddress) {
    orderState.address = extractedAddress;
  }
  
  if (sessionState.orderStep === 'phone' && !orderState.phone && trimmed.match(/\d{10,}/)) {
    orderState.phone = trimmed.replace(/\D/g, '');
  }
  
  if (sessionState.orderStep === 'city' && !orderState.city) {
    if (/^[a-zA-Z\s]{3,20}$/.test(trimmed)) {
      const cities = ['lahore', 'karachi', 'islamabad', 'peshawar', 'quetta', 'multan', 'faisalabad', 'rawalpindi'];
      const cityMatch = cities.find(c => c === trimmed.toLowerCase());
      if (cityMatch) {
        orderState.city = cityMatch.charAt(0).toUpperCase() + cityMatch.slice(1);
      }
    }
  }
  
  if (sessionState.orderStep === 'address' && !orderState.address) {
    if (trimmed.split(/\s+/).length >= 2 || trimmed.length > 15) {
      orderState.address = trimmed;
    }
  }
  
  if (orderState.items.length === 0) {
    sessionState.orderStep = 'product';
    return "Sure! Which keychain(s) would you like to order? You can say things like:\n- 'Batman'\n- 'Batman and Iron Man'\n- '3 Spider-Man'";
  }
  
  const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
  if (itemsNeedingQty.length > 0 && !sessionState.orderStep?.startsWith('qty_')) {
    const currentItem = itemsNeedingQty[0];
    sessionState.orderStep = `qty_${currentItem.product.split(' ')[0].toLowerCase()}`;
    if (itemsNeedingQty.length === 1) {
      return `How many ${currentItem.product} do you need?`;
    }
    return `How many ${currentItem.product}? (We'll ask for each item)`;
  }
  
  if (!orderState.name) {
    sessionState.orderStep = 'name';
    const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product || 'Unknown'}`).join(', ');
    return `Perfect! Your order: ${itemsList}. What's your name?`;
  }
  
  if (!orderState.phone) {
    sessionState.orderStep = 'phone';
    return `Thanks ${orderState.name}! What's your phone number?`;
  }
  
  if (!orderState.city) {
    sessionState.orderStep = 'city';
    return "Which city should we deliver to?";
  }
  
  if (!orderState.address) {
    sessionState.orderStep = 'address';
    return "What's your full delivery address?";
  }
  
  orderState.confirmed = false;
  const { text } = formatOrderSummary(orderState);
  return text;
}

export async function POST(request: NextRequest) {
  // The chat endpoint is unauthenticated and calls OpenRouter, so it is the most
  // expensive public endpoint on the site. Throttling it bounds both database load
  // and AI spend.
  const limited = rateLimit(request, RATE_LIMITS.chat);
  if (!limited.ok) {
    return NextResponse.json(
      { message: "I'm getting a lot of messages right now. Please try again in a moment." },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  try {
    const body = await request.json();
    const { messages, sessionId: clientSessionId } = body as {
      messages: Array<{ role: string; content: string }>;
      sessionId?: string;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const sessionId = clientSessionId || generateSessionId();
    const sessionState = getOrCreateSession(sessionId);

    // Restore an order that was in progress before the server restarted, so the
    // customer does not have to type their details (or the order) again.
    const cookieState = decodeChatState(request.cookies.get(CHAT_STATE_COOKIE)?.value);
    if (
      cookieState &&
      cookieState.orderState.items.length > 0 &&
      sessionState.orderState.items.length === 0 &&
      !sessionState.orderStep
    ) {
      sessionState.orderState = cookieState.orderState;
      sessionState.orderStep = cookieState.orderStep;
    }
    
    const conversationHistory = conversations.get(sessionId) || [];
    const userMessage = messages[messages.length - 1];
    
    if (userMessage.role === 'user') {
      conversationHistory.push({
        role: 'user',
        content: userMessage.content,
        timestamp: new Date()
      });
    }
    
    const products = await getProductContext();
    
    trackMentionedProducts(userMessage.content, products, sessionState);
    
    const lastUserMsg = userMessage.content.toLowerCase();
    const isOrderIntent = lastUserMsg.includes('order') || lastUserMsg.includes('buy') || 
                          lastUserMsg.includes('chahiye') || lastUserMsg.includes('bhej');
    
    let response: string;
    
    const sessionContext = {
      lastProductsMentioned: sessionState.mentionedProducts || [],
      lastUserMessage: sessionState.lastUserMessage,
      orderStep: sessionState.orderStep,
    };
    
    if (sessionState.orderStep || isOrderIntent) {
      const orderResponse = await handleOrderFlow(sessionState, userMessage.content, products);
      if (orderResponse) {
        response = orderResponse;
      } else {
        response = await generateLLMResponse(conversationHistory, products, sessionContext);
      }
    } else {
      response = await generateLLMResponse(conversationHistory, products, sessionContext);
    }
    
    if (sessionState.lastAssistantMessage === response) {
      response += " Anything else I can help with?";
    }
    
    sessionState.lastAssistantMessage = response;
    sessionState.lastUserMessage = userMessage.content;
    sessions.set(sessionId, sessionState);
    
    conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });
    conversations.set(sessionId, conversationHistory.slice(-20));

    const chatResponse = NextResponse.json({
      message: response,
      sessionId: sessionId,
    });

    // Persist the in-progress order so a restart/hot-reload cannot drop it.
    chatResponse.cookies.set({
      name: CHAT_STATE_COOKIE,
      value: encodeChatState(sessionState),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24,
    });

    return chatResponse;
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { message: "Sorry, I encountered an error. Please try again!" },
      { status: 200 }
    );
  }
}
