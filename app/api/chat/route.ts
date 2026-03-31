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

const FALLBACK_PRODUCTS = [
  { id: 'neon-genesis', name: 'Neon Genesis Evangelion', category: 'Anime', price: 599, rating: 4.8 },
  { id: 'attack-titan', name: 'Attack on Titan', category: 'Anime', price: 549, rating: 4.9 },
  { id: 'demon-slayer', name: 'Demon Slayer', category: 'Anime', price: 649, rating: 4.7 },
  { id: 'jujutsu-kaisen', name: 'Jujutsu Kaisen', category: 'Anime', price: 599, rating: 4.8 },
  { id: 'naruto', name: 'Naruto', category: 'Anime', price: 549, rating: 4.7 },
  { id: 'one-piece', name: 'One Piece', category: 'Anime', price: 699, rating: 4.9 },
  { id: 'batman', name: 'Batman Icon', category: 'Superhero', price: 599, rating: 4.8 },
  { id: 'superman', name: 'Superman Shield', category: 'Superhero', price: 599, rating: 4.7 },
  { id: 'wonder-woman', name: 'Wonder Woman Lasso', category: 'Superhero', price: 649, rating: 4.9 },
  { id: 'iron-man', name: 'Iron Man Arc Reactor', category: 'Marvel', price: 699, rating: 4.9 },
  { id: 'spider-man', name: 'Spider-Man Web', category: 'Marvel', price: 549, rating: 4.8 },
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
        rating: p.rating || 4.5
      }));
    }
  } catch (error) {
    console.warn('Failed to get products from Supabase, using fallback');
  }
  return FALLBACK_PRODUCTS;
}

function getOrCreateSession(sessionId: string): SessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { orderState: { items: [] } });
  }
  return sessions.get(sessionId)!;
}

function findProductsInMessage(
  userMessage: string,
  products: any[]
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
    const nameWords = nameLower.split(/\s+/).filter((w: string) => w.length > 2);
    if (nameWords.some((word: string) => {
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
  
  // First pass: look for explicit quantity patterns for ALL products at once
  const allAtOncePatterns = [
    // "3 spiderman and 5 ironman" or "spiderman 3 and ironman 5"
    /^.*?(\d+)\s+(?:x|×)?\s*(\w+).*?(\d+)\s+(?:x|×)?\s*(\w+).*$/i,
    // "3 spiderman, 5 ironman"
    /^.*?(\d+)\s+(\w+).*?,?\s*(\d+)\s+(\w+).*$/i,
  ];
  
  for (const pattern of allAtOncePatterns) {
    const match = userMessage.match(pattern);
    if (match) {
      // Try to extract both quantities
      for (const name of productNames) {
        const nameLower = name.toLowerCase();
        for (let i = 1; i < match.length - 1; i++) {
          const qtyOrName = match[i];
          const nextVal = match[i + 1];
          if (nextVal && !isNaN(parseInt(nextVal))) {
            const qty = parseInt(nextVal);
            const possibleName = match[i + 2] || match[i];
            if (possibleName && possibleName.toLowerCase().includes(name.split(' ')[0].toLowerCase())) {
              if (qty > 0 && qty <= 100) {
                quantities.set(name, qty);
              }
            }
          }
        }
      }
    }
  }
  
  // Second pass: look for explicit quantity patterns per product
  for (const name of productNames) {
    const nameLower = name.toLowerCase();
    const patterns = [
      // "3 Batman" or "3x Batman"
      new RegExp(`(\\d+)\\s+(?:x|×)?\\s*(${nameLower})`, 'i'),
      // "Batman 3"
      new RegExp(`(${nameLower})\\s*(?:x|×)?\\s*(\\d+)`, 'i'),
      // "3 pieces of Batman"
      new RegExp(`(${nameLower}).*?(\\d+)\\s*(?:pieces?|keychains?|pcs?)`, 'i'),
      // "Batman x3"
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
  
  // Third pass: if no explicit quantities found, check for common phrases
  if (quantities.size === 0) {
    const numberWords: Record<string, number> = {
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
  
  // Fourth pass: if still no quantities found, return empty map to trigger quantity questions
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
    
    let totalItems = 0;
    let subtotal = 0;
    for (const item of orderState.items) {
      totalItems += item.quantity;
      subtotal += item.price * item.quantity;
    }
    const shipping = 250;
    const total = subtotal + shipping;
    
    const itemsList = orderState.items.map(i => `${i.product} x${i.quantity}`).join(', ');
    
    const orders = await getOrders();
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
      items_data: orderState.items,
    };
    
    await addOrder(newOrder);
    
    return `🎉 Order confirmed!\n\n📦 Order: ${itemsList}\n💰 Total: Rs ${total}\n📍 Delivery to: ${orderState.city}\n\n🆔 Order ID: ${newOrder.id}\n\nYou'll receive a confirmation call shortly. Thanks for shopping with HEROIX!`;
  }
  
  // Handle quantity step for individual items
  if (sessionState.orderStep?.startsWith('qty_')) {
    const productName = sessionState.orderStep.replace('qty_', '');
    const item = orderState.items.find(i => i.product.toLowerCase().includes(productName));
    
    if (item) {
      const qtyMatch = trimmed.match(/\d+/);
      if (qtyMatch) {
        const qty = parseInt(qtyMatch[0]);
        if (qty > 0 && qty <= 100) {
          item.quantity = qty;
          
          // Check if there are more items needing quantity (where quantity is still 0)
          const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
          
          if (itemsNeedingQty.length > 0) {
            const nextItem = itemsNeedingQty[0];
            sessionState.orderStep = `qty_${nextItem.product.split(' ')[0].toLowerCase()}`;
            
            // Show what we have so far
            const itemsWithQty = orderState.items.filter(i => i.quantity > 0);
            const soFar = itemsWithQty.map(i => `${i.quantity}x ${i.product}`).join(', ');
            
            return `Got it! ${qty}x ${item.product}. Now how many ${nextItem.product}?`;
          }
          
          // All quantities set, move to name
          sessionState.orderStep = 'name';
          const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product}`).join(', ');
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
        const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product}`).join(', ');
        return `Perfect! Your order: ${itemsList}. What's your name?`;
      }
      return `Please tell me how many ${item.product} you need (e.g., 1, 2, 3...)`;
    }
  }
  
  const foundProducts = findProductsInMessage(userMessage, products);
  if (foundProducts.length > 0) {
    const quantities = extractQuantitiesForProducts(userMessage, foundProducts.map(p => p.name));
    
    // Check if ANY products have explicit quantities specified (greater than 1)
    let anyExplicitQty = false;
    for (const found of foundProducts) {
      const qty = quantities.get(found.name);
      if (qty && qty > 1) {
        anyExplicitQty = true;
        break;
      }
    }
    
    // First, clear items with quantity=0 and add fresh ones
    // Remove items that don't have confirmed quantities yet
    const confirmedItems = orderState.items.filter(i => i.quantity > 0);
    orderState.items = [...confirmedItems];
    
    // Add new products with quantity=0 (not yet confirmed)
    for (const found of foundProducts) {
      const existingIndex = orderState.items.findIndex(i => i.productId === found.id);
      const qty = quantities.get(found.name) || 0; // 0 means needs confirmation
      
      if (existingIndex >= 0) {
        // Update existing item
        if (qty > 0) orderState.items[existingIndex].quantity = qty;
      } else {
        orderState.items.push({
          product: found.name,
          productId: found.id,
          price: found.price,
          quantity: qty // 0 = needs confirmation
        });
      }
    }
    
    // Count how many items need quantity confirmation
    const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
    
    if (itemsNeedingQty.length > 0) {
      if (itemsNeedingQty.length === 1) {
        // Only one item needs quantity
        const currentItem = itemsNeedingQty[0];
        sessionState.orderStep = `qty_${currentItem.product.split(' ')[0].toLowerCase()}`;
        return `Got it! You want ${currentItem.product}. How many do you need?`;
      }
      
      // Multiple items - ask for quantities for all at once
      sessionState.orderStep = 'qty_all';
      const itemList = itemsNeedingQty.map((item, idx) => `${idx + 1}. ${item.product}`).join(', ');
      return `I found ${itemsNeedingQty.length} keychains: ${itemList}. Please tell me the quantity for each (e.g., "3 for spiderman and 5 for ironman" or just "3, 5"):`;
    }
    
    // All items have quantity, move to name
    sessionState.orderStep = 'name';
    const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product}`).join(', ');
    return `Perfect! Your order: ${itemsList}. What's your name?`;
  }
  
  // Handle "qty_all" step - multiple items need quantities at once
  if (sessionState.orderStep === 'qty_all') {
    const itemsNeedingQty = orderState.items.filter(i => i.quantity === 0);
    if (itemsNeedingQty.length > 0) {
      // Try to extract quantities from the message
      const lower = userMessage.toLowerCase();
      let allHaveQty = true;
      
      for (const item of itemsNeedingQty) {
        const itemLower = item.product.toLowerCase();
        const firstWord = item.product.split(' ')[0].toLowerCase();
        
        // Look for pattern like "3 for spiderman" or "spiderman: 3" or just "3"
        const patterns = [
          new RegExp(`(\\d+)\\s+(?:x|×)?\\s*(?:for|of)?\\s*${firstWord}`, 'i'),
          new RegExp(`${firstWord}.*?:\\s*(\\d+)`, 'i'),
          new RegExp(`(${itemLower}).*?(\\d+)`, 'i'),
        ];
        
        let foundQty = 0;
        for (const pattern of patterns) {
          const match = lower.match(pattern);
          if (match) {
            foundQty = parseInt(match[1]);
            if (foundQty > 0 && foundQty <= 100) break;
          }
        }
        
        // If no pattern matched, try to find standalone numbers
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
        const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product}`).join(', ');
        return `Perfect! Your order: ${itemsList}. What's your name?`;
      }
      
      // Still missing quantities, ask again
      const remainingItems = itemsNeedingQty.filter(i => i.quantity === 0);
      if (remainingItems.length === 1) {
        sessionState.orderStep = `qty_${remainingItems[0].product.split(' ')[0].toLowerCase()}`;
        return `How many ${remainingItems[0].product} do you need?`;
      }
      
      const itemList = remainingItems.map((item, idx) => `${idx + 1}. ${item.product}`).join(', ');
      return `Please specify quantities for: ${itemList}`;
    }
  }
  
  // Extract customer details
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
  
  // If we're at the phone step and user provides a number
  if (sessionState.orderStep === 'phone' && !orderState.phone && trimmed.match(/\d{10,}/)) {
    orderState.phone = trimmed.replace(/\D/g, '');
  }
  
  // If we're at the city step
  if (sessionState.orderStep === 'city' && !orderState.city) {
    if (/^[a-zA-Z\s]{3,20}$/.test(trimmed)) {
      const cities = ['lahore', 'karachi', 'islamabad', 'peshawar', 'quetta', 'multan', 'faisalabad', 'rawalpindi'];
      const cityMatch = cities.find(c => c === trimmed.toLowerCase());
      if (cityMatch) {
        orderState.city = cityMatch.charAt(0).toUpperCase() + cityMatch.slice(1);
      }
    }
  }
  
  // If we're at the address step
  if (sessionState.orderStep === 'address' && !orderState.address) {
    if (trimmed.split(/\s+/).length >= 2 || trimmed.length > 15) {
      orderState.address = trimmed;
    }
  }
  
  // State machine for order flow
  if (orderState.items.length === 0) {
    sessionState.orderStep = 'product';
    return "Sure! Which keychain(s) would you like to order? You can say things like:\n- 'Batman'\n- 'Batman and Iron Man'\n- '3 Spider-Man'";
  }
  
  // Check if we still need quantities for some items
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
    const itemsList = orderState.items.map(i => `${i.quantity}x ${i.product}`).join(', ');
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
    
    const products = await getProductContext();
    
    const lastUserMsg = userMessage.content.toLowerCase();
    const isOrderIntent = lastUserMsg.includes('order') || lastUserMsg.includes('buy') || 
                          lastUserMsg.includes('chahiye') || lastUserMsg.includes('bhej');
    
    let response: string;
    
    if (sessionState.orderStep || isOrderIntent) {
      const orderResponse = await handleOrderFlow(sessionState, userMessage.content, products);
      if (orderResponse) {
        response = orderResponse;
      } else {
        response = await generateLLMResponse(conversationHistory, products);
      }
    } else {
      response = await generateLLMResponse(conversationHistory, products);
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