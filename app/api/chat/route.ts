import { NextRequest, NextResponse } from 'next/server';
import { generateLLMResponse, ChatMessage } from '@/lib/llm';
import { getServerProducts } from '@/lib/server-products';
import { getOrders, addOrder, AdminOrder } from '@/lib/orders-store';

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
}

const sessions = new Map<string, SessionState>();
const conversations = new Map<string, ChatMessage[]>();

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getProductContext(): string {
  const products = getServerProducts();
  if (products.length === 0) {
    return 'No products currently available.';
  }
  return products
    .map(p => `${p.name} (${p.category}): Rs ${p.price}`)
    .join('\n');
}

function getOrCreateSession(sessionId: string): SessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { orderState: { items: [] } });
  }
  return sessions.get(sessionId)!;
}

function findProductsInMessage(
  userMessage: string,
  products: Array<{id: string; name: string; category: string; price: number}>
): Array<{id: string; name: string; price: number}> {
  const lower = userMessage.toLowerCase();
  const found: Array<{id: string; name: string; price: number}> = [];
  
  // Sort products by name length (longer names first) to match more specific products first
  const sortedProducts = [...products].sort((a, b) => b.name.length - a.name.length);
  
  for (const product of sortedProducts) {
    const nameLower = product.name.toLowerCase();
    
    // Check for exact match first
    if (lower.includes(nameLower)) {
      if (!found.find(p => p.id === product.id)) {
        found.push({ id: product.id, name: product.name, price: product.price });
      }
      continue;
    }
    
    // Check for partial matches with word boundaries
    const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2);
    if (nameWords.some(word => {
      const wordBoundaryPattern = new RegExp(`\\b${word}\\b`, 'i');
      return wordBoundaryPattern.test(lower);
    })) {
      if (!found.find(p => p.id === product.id)) {
        found.push({ id: product.id, name: product.name, price: product.price });
      }
    }
  }
  
  return found;
}

function extractQuantitiesForProducts(
  userMessage: string,
  productNames: string[]
): Map<string, number> {
  const quantities = new Map<string, number>();
  const lower = userMessage.toLowerCase();
  
  // First pass: look for explicit quantity patterns
  for (const name of productNames) {
    const nameLower = name.toLowerCase();
    const patterns = [
      // "3 Batman and 2 Joker" pattern
      new RegExp(`(\\d+)\\s+(?:x|×)?\\s*(${nameLower})`, 'i'),
      // "Batman 3 and Joker 2" pattern  
      new RegExp(`(${nameLower})\\s*(?:x|×)?\\s*(\\d+)`, 'i'),
      // "3 pieces of Batman" pattern
      new RegExp(`(${nameLower}).*?(\\d+)\\s*(?:pieces?|keychains?|pcs?)`, 'i'),
      // "Batman x3" pattern
      new RegExp(`(${nameLower})\\s*x\\s*(\\d+)`, 'i'),
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
  
  // Second pass: if no explicit quantities found, check for common phrases
  if (quantities.size === 0) {
    // Check for "one", "two", "three", etc.
    const numberWords = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    for (const name of productNames) {
      const nameLower = name.toLowerCase();
      for (const [word, num] of Object.entries(numberWords)) {
        const pattern = new RegExp(`(${word})\\s+(${nameLower})`, 'i');
        if (pattern.test(lower)) {
          quantities.set(name, num);
          break;
        }
      }
    }
  }
  
  // Third pass: if still no quantities, default to 1 for each product
  for (const name of productNames) {
    if (!quantities.has(name)) {
      quantities.set(name, 1);
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
    const validWords = words.filter(w => 
      w.length >= 2 && 
      /^[a-zA-Z]+$/.test(w) &&
      !['order', 'want', 'need', 'please', 'thanks', 'thank'].includes(w.toLowerCase())
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
  shipping: number = 250
): { text: string; subtotal: number; total: number } {
  let subtotal = 0;
  let itemsText = '';
  
  for (const item of orderState.items) {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    itemsText += `• ${item.product} x${item.quantity} = Rs ${itemTotal}\n`;
  }
  
  const total = subtotal + shipping;
  
  const text = `📋 Order Summary:\n\n${itemsText}• Shipping = Rs ${shipping}\n• Total = Rs ${total}\n\n📍 Delivery to:\n${orderState.name}\n${orderState.city}\n${orderState.address}\n📱 Phone: ${orderState.phone}\n\nReply "yes" to confirm or "cancel" to start over.`;
  
  return { text, subtotal, total };
}

function handleOrderFlow(
  sessionState: SessionState,
  userMessage: string,
  products: Array<{id: string; name: string; category: string; price: number}>
): string | null {
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
    
    let totalItems = 0;
    let subtotal = 0;
    for (const item of orderState.items) {
      totalItems += item.quantity;
      subtotal += item.price * item.quantity;
    }
    const shipping = 250;
    const total = subtotal + shipping;
    
    const itemsList = orderState.items.map(i => `${i.product} x${i.quantity}`).join(', ');
    
    const orders = getOrders();
    const newOrder: AdminOrder = {
      id: `ORD-${String(orders.length + 1).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      customer: orderState.name || 'Unknown',
      email: '',
      phone: orderState.phone || '',
      address: orderState.address || '',
      city: orderState.city || '',
      items: totalItems,
      total: total,
      status: 'pending',
    };
    
    addOrder(newOrder);
    
    return `🎉 Order confirmed!\n\n📦 Order: ${itemsList}\n💰 Total: Rs ${total}\n📍 Delivery to: ${orderState.city}\n\n🆔 Order ID: ${newOrder.id}\n\nYou'll receive a confirmation call shortly. Thanks for shopping with HEROIX!`;
  }
  
  const foundProducts = findProductsInMessage(userMessage, products);
  if (foundProducts.length > 0) {
    const quantities = extractQuantitiesForProducts(userMessage, foundProducts.map(p => p.name));
    
    for (const found of foundProducts) {
      const existingIndex = orderState.items.findIndex(i => i.productId === found.id);
      const qty = quantities.get(found.name) || 1;
      
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
    return "Sure! Which keychains would you like to order? You can say things like:\n- 'Batman and Joker'\n- 'Iron Man, Naruto and Flash'\n- '3 Spider-Man and 2 Batman'";
  }
  
  if (!orderState.name) {
    sessionState.orderStep = 'name';
    const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product}`).join(', ');
    return `Got it! You're ordering: ${itemsList}. What's your name?`;
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
  try {
    const body = await request.json();
    const { messages, sessionId: clientSessionId } = body as {
      messages: Array<{ role: string; content: string }>;
      sessionId?: string;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    let sessionId = clientSessionId || generateSessionId();
    const sessionState = getOrCreateSession(sessionId);
    
    let conversationHistory = conversations.get(sessionId) || [];
    const userMessage = messages[messages.length - 1];
    
    if (userMessage.role === 'user') {
      conversationHistory.push({
        role: 'user',
        content: userMessage.content,
        timestamp: new Date()
      });
    }
    
    const products = getServerProducts();
    const productContext = getProductContext();
    
    const lastUserMsg = userMessage.content.toLowerCase();
    const isOrderIntent = lastUserMsg.includes('order') || lastUserMsg.includes('buy') || 
                          lastUserMsg.includes('chahiye') || lastUserMsg.includes('bhej');
    
    let response: string;
    
    if (sessionState.orderStep || isOrderIntent) {
      const orderResponse = handleOrderFlow(sessionState, userMessage.content, products);
      if (orderResponse) {
        response = orderResponse;
      } else {
        response = await generateLLMResponse(conversationHistory, productContext);
      }
    } else {
      response = await generateLLMResponse(conversationHistory, productContext);
    }
    
    if (sessionState.lastAssistantMessage === response) {
      response += " Anything else I can help with?";
    }
    
    sessionState.lastAssistantMessage = response;
    sessions.set(sessionId, sessionState);
    
    conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });
    conversations.set(sessionId, conversationHistory.slice(-20));

    return NextResponse.json({
      message: response,
      sessionId: sessionId,
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { message: "Sorry, I encountered an error. Please try again!" },
      { status: 200 }
    );
  }
}