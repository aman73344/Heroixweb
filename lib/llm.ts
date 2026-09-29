// OpenRouter LLM Integration for Heroix AI Sales Assistant
// Properly calls OpenRouter API for natural AI responses

import { NAYAPAY_ACCOUNT_NAME, NAYAPAY_ACCOUNT_NUMBER, HEROIX_WHATSAPP_DISPLAY } from './store-config';
import { parseVariants } from './variants';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  rating?: number;
  reviews?: number;
  inStock?: boolean;
  stock?: number;
  variants?: any[];
}

interface OpenRouterChoice {
  message: {
    role: string;
    content: string;
  };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
  error?: {
    message: string;
    type: string;
  };
}

const SYSTEM_PROMPT_TEMPLATE = (products: Product[], sessionContext?: any) => `You are HEROIX, a friendly ecommerce sales assistant for an anime/superhero keychain store in Pakistan. Be conversational, helpful, and guide customers to purchases.

STORE INFO:
- We sell Anime, Superhero, Marvel, DC, Sports, Gaming and Others keychains
- Prices: Rs 450-750
- Shipping: Rs 280 delivery charge nationwide (5-7 days)
- Payment: NayaPay ONLY - NO Cash on Delivery, no SadaPay/Easypaisa/JazzCash/bank transfer
- NayaPay account number: ${NAYAPAY_ACCOUNT_NUMBER} (account name: ${NAYAPAY_ACCOUNT_NAME})
- After a customer places an order we contact them on WhatsApp (${HEROIX_WHATSAPP_DISPLAY}); the order is NOT confirmed until the NayaPay payment is received. Once the payment screenshot arrives on WhatsApp, the order is confirmed and moves forward.
- Based in Pakistan

PRODUCT CATALOG (CRITICAL - Use exact names):
${products.length > 0 
  ? products.map(p => {
      let variantStockStr = '';
      if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
        // Render only the design names + stock (never the stored picture URLs or
        // "desc:" attributes) so the prompt stays clean.
        const parsedVariants = parseVariants(p.variants, typeof p.stock === 'number' ? p.stock : 0);
        if (parsedVariants.length > 0) {
          variantStockStr = ` [designs: ${parsedVariants
            .map((v) => `${v.name} (stock ${v.stock})`)
            .join(', ')}]`;
        }
      }
      return `- "${p.name}" (${p.category}): Rs ${p.price} - ${p.description || 'Premium quality keychain'}${typeof p.stock === 'number' ? (p.stock > 0 ? ` [stock: ${p.stock}]` : ' [OUT OF STOCK - stock: 0]') : ''}${variantStockStr}`;
    }).join('\n')
  : 'No products currently available'
}

${sessionContext?.lastProductsMentioned?.length > 0 
  ? `USER RECENTLY MENTIONED: ${sessionContext.lastProductsMentioned.map((p: string) => `"${p}"`).join(', ')}. If user says "only these", "just these", "only these ones", refer to these products.`
  : ''}

CRITICAL DISAMBIGUATION RULES:
When user mentions a product:
1. If EXACT product name exists → acknowledge that specific product
2. If MULTIPLE products match (e.g., "spiderman" could be "Spider-Man Web" OR "Spider-Man Spinning"):
   - List the matching products clearly with distinguishing features
   - Ask user to specify which one they want
   - Example: "I found multiple Spider-Man keychains! Which one do you mean? 
     - Spider-Man Web (Rs 549)
     - Spider-Man Spinning (Rs 500)"
3. If user says "all", "both", "everything" with multiple matches → confirm they want ALL of them
4. If user says "only", "just", "only these" → respect their specificity

CATEGORY FILTERING:
- DC: Batman, Superman, Wonder Woman, Flash, Aquaman, Justice League
- Marvel: Iron Man, Spider-Man, Thor, Captain America, Avengers, X-Men
- Anime: Naruto, One Piece, Dragon Ball Z, Attack on Titan, Demon Slayer, Jujutsu Kaisen, Evangelion
- Sports: Ronaldo, Messi, Football, Cricket
- Gaming: gamer keychains, game logos, game characters
- Others: anything else in the catalogue that fits no category above

LIST COMMANDS:
- "list all" / "show everything" → list all available products
- "list new" / "new arrivals" → mention our latest additions
- "list [category]" → show only that category

IMPORTANT ORDER FLOW:
When customer wants to order:
1. Confirm exact product(s) - ask if ambiguous
2. Ask for QUANTITY (always ask "How many do you need?")
3. Ask for name
4. Ask for phone number
5. Ask for city
6. Ask for full address
7. Confirm order with summary and ask "Reply yes to confirm"
8. Remind them: payment is NayaPay ONLY (account number ${NAYAPAY_ACCOUNT_NUMBER} - ${NAYAPAY_ACCOUNT_NAME}); we WhatsApp them on (${HEROIX_WHATSAPP_DISPLAY}) and the order is confirmed ONLY after the NayaPay payment is received - without payment the order does not move forward

PAYMENT QUESTIONS:
- If asked about payment / COD / cash on delivery / easypaisa / jazzcash / bank: we take NayaPay ONLY (account number ${NAYAPAY_ACCOUNT_NUMBER}, account name ${NAYAPAY_ACCOUNT_NAME}), coordinated over WhatsApp (${HEROIX_WHATSAPP_DISPLAY}). Never say Cash on Delivery is available and never offer SadaPay, Easypaisa, JazzCash or bank transfer. The order is not confirmed until the payment is received.

STOCK (REAL-TIME):
- The catalog shows [stock: N] per product - this is the REAL stock count and it drops with every order.
- If a product shows [OUT OF STOCK - stock: 0], say it is unavailable and suggest 1-2 similar in-stock products instead.
- If asked whether something is in stock, answer using its stock number. NEVER say "everything is in stock" or "all items ready to ship" when some products are out of stock.

RULES:
- Keep responses SHORT (1-2 sentences max for casual chat)
- When showing products, ALWAYS include distinguishing details
- Use Pakistani Rupees (Rs) for prices
- NEVER say "as an AI" or similar
- Be precise about which specific product you mean`;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export async function generateLLMResponse(
  messages: ChatMessage[],
  products: Product[],
  sessionContext?: { lastProductsMentioned?: string[] }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return generateEnhancedFallbackResponse(messages, products, sessionContext);
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE(products, sessionContext);
  
  const models = [
    'nvidia/nemotron-3-super-120b-a12b:free',
    'openrouter/free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'google/gemma-4-31b-it:free',
  ];
  
  for (const model of models) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          'X-Title': 'HEROIX AI Assistant',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
          ],
          max_tokens: 600,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (response.ok) {
        const data: OpenRouterResponse = await response.json();
        
        if (data.error) {
          console.warn(`Model ${model} error:`, data.error.message);
          continue;
        }
        
        let content = data.choices?.[0]?.message?.content?.trim();
        
        if (model.includes('deepseek') || model.includes('r1')) {
          const thinkMatch = content?.match(/<\/think>\s*([\s\S]*)$/);
          if (thinkMatch) {
            content = thinkMatch[1].trim();
          }
        }
        
        if (content && content.length > 5) {
          return content;
        }
      } else {
        const errorText = await response.text();
        console.warn(`Model ${model} failed:`, response.status, errorText.substring(0, 200));
      }
    } catch (error: any) {
      console.warn(`Model ${model} exception:`, error.message);
    }
  }

  return generateEnhancedFallbackResponse(messages, products, sessionContext);
}

function generateEnhancedFallbackResponse(
  messages: ChatMessage[], 
  products: Product[],
  sessionContext?: { lastProductsMentioned?: string[] }
): string {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const fullMessage = messages[messages.length - 1]?.content || '';
  
  const validProducts = Array.isArray(products) && products.length > 0 ? products : [];
  
  const disambiguateProducts = (matches: Product[]): string | null => {
    if (matches.length === 0) return null;
    if (matches.length === 1) return null;
    
    const names = matches.map(p => `- ${p.name} (Rs ${p.price})`).join('\n');
    return `I found ${matches.length} options. Which one do you mean?\n${names}`;
  };
  
  if (/^(hi|hello|hey|assalam|asalam|khair|salaam|good morning|good evening|hy|heya)/i.test(fullMessage)) {
    return "Hey there! 👋 Welcome to HEROIX! We have amazing anime, superhero & sports keychains. Just tell me what you're looking for!";
  }
  
  if (/thanks|thank you|shukriya|mersh|thnx/i.test(lastMessage)) {
    return "You're welcome! 😊 Is there anything else I can help you with?";
  }
  
  if (/cancel|band karo|band krdo/i.test(lastMessage)) {
    return "Order cancelled! Let me know if you need anything else.";
  }
  
  const onlyThesePatterns = /only these|just these|only this|only these ones|bas yeh|bas yehi|sirf yeh/i;
  if (onlyThesePatterns.test(lastMessage) && sessionContext?.lastProductsMentioned?.length) {
    const mentionedProducts = sessionContext.lastProductsMentioned
      .map(name => validProducts.find(p => p.name.toLowerCase().includes(name.toLowerCase())))
      .filter(Boolean);
    
    if (mentionedProducts.length > 0) {
      return `Got it! ${mentionedProducts.map(p => p!.name).join(', ')} - just confirm the quantity for each when you're ready to order!`;
    }
  }
  
  const listAllPatterns = /list all|show all|everything|sab|dikhao sab|sab dikhao|all products/i;
  if (listAllPatterns.test(lastMessage)) {
    if (validProducts.length > 0) {
      const chunks = [];
      for (let i = 0; i < validProducts.length; i += 5) {
        chunks.push(validProducts.slice(i, i + 5).map(p => `${p.name} (Rs ${p.price})`).join(', '));
      }
      return `Here's our full catalog:\n${chunks.join('\n')}\n\nWhich ones catch your eye?`;
    }
    return "Let me check our inventory and get back to you!";
  }
  
  const listCategoryPatterns = /(?:list|show|view| dikhao).*?(dc|marvel|anime|dragon ball|sports|superhero|gaming|games|others|batman|superman|spider|iron|thor|football|cricket)/i;
  const categoryMatch = lastMessage.match(listCategoryPatterns);
  if (categoryMatch) {
    const category = categoryMatch[1].toLowerCase();
    const categoryProducts = validProducts.filter(p => {
      const searchText = (p.name + ' ' + p.category).toLowerCase();
      return searchText.includes(category);
    });
    
    if (categoryProducts.length > 0) {
      const list = categoryProducts.map(p => `${p.name} (Rs ${p.price})`).join(', ');
      return `${category.charAt(0).toUpperCase() + category.slice(1)} collection: ${list}. Which one do you like?`;
    }
  }
  
  if (/order|buy|chahiye|mangta|leni|chaiye|bhej|bhejna|lagana|order karna|order krna/i.test(lastMessage)) {
    const matchedProducts: Product[] = [];
    
    for (const product of validProducts) {
      const nameWords = product.name.toLowerCase().split(/\s+/);
      if (nameWords.every(word => word.length > 2 && lastMessage.includes(word))) {
        matchedProducts.push(product);
      }
    }
    
    if (matchedProducts.length > 1) {
      const disambig = disambiguateProducts(matchedProducts);
      if (disambig) return disambig;
    }
    
    if (matchedProducts.length === 1) {
      return `Great! You want ${matchedProducts[0].name} (Rs ${matchedProducts[0].price}). How many do you need?`;
    }
    
    if (validProducts.length > 0) {
      return `We have ${validProducts.length} keychains! Tell me which one(s) you'd like to order.`;
    }
    return "I'd love to help you order! Tell me which keychain catches your eye!";
  }
  
  for (const product of validProducts) {
    const nameWords = product.name.toLowerCase().split(/\s+/);
    if (nameWords.every(word => word.length > 2 && lastMessage.includes(word))) {
      const exactMatches = validProducts.filter(p => {
        const words = p.name.toLowerCase().split(/\s+/);
        return words.every(word => word.length > 2 && lastMessage.includes(word));
      });
      
      if (exactMatches.length > 1) {
        return disambiguateProducts(exactMatches) || "Found multiple matches!";
      }
      
      return `Yes! We have ${product.name} for Rs ${product.price}. Want to order? Just tell me how many you need!`;
    }
  }
  
  const keywords = ['goku', 'vegeta', 'naruto', 'luffy', 'zoro', 'spiderman', 'spidey', 'batman', 'ironman', 'thor', 'superman', 'messi', 'ronaldo'];
  for (const keyword of keywords) {
    if (lastMessage.includes(keyword)) {
      const matches = validProducts.filter(p => 
        p.name.toLowerCase().includes(keyword)
      );
      if (matches.length > 1) {
        return disambiguateProducts(matches) || "Found multiple matches!";
      }
      if (matches.length === 1) {
        return `Yes! We have ${matches[0].name} for Rs ${matches[0].price}. Want to order?`;
      }
    }
  }
  
  const animeKeywords = ['anime', 'naruto', 'one piece', 'dragon ball', 'attack on titan', 'demon slayer', 'jujutsu', 'evangelion', 'bleach', 'cosplay'];
  if (animeKeywords.some(k => lastMessage.includes(k))) {
    const animeProducts = validProducts.filter(p => 
      animeKeywords.some(k => (p.name + ' ' + p.category).toLowerCase().includes(k))
    );
    if (animeProducts.length > 0) {
      return `Anime fan! 🎌 ${animeProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which one do you like?`;
    }
    return "We have tons of anime keychains! Tell me which anime is your favorite.";
  }
  
  const marvelKeywords = ['marvel', 'iron man', 'spider', 'thor', 'captain', 'avenger'];
  if (marvelKeywords.some(k => lastMessage.includes(k))) {
    const marvelProducts = validProducts.filter(p => 
      marvelKeywords.some(k => (p.name + ' ' + p.category).toLowerCase().includes(k))
    );
    if (marvelProducts.length > 0) {
      return `Marvel fan! 🦸 ${marvelProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which hero is your favorite?`;
    }
    return "We've got Iron Man, Spider-Man, Thor, Captain America and more!";
  }
  
  const dcKeywords = ['dc', 'batman', 'superman', 'flash', 'aquaman', 'wonder woman', 'justice league'];
  if (dcKeywords.some(k => lastMessage.includes(k))) {
    const dcProducts = validProducts.filter(p => 
      dcKeywords.some(k => (p.name + ' ' + p.category).toLowerCase().includes(k))
    );
    if (dcProducts.length > 0) {
      return `DC fan! 🦇 ${dcProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which hero do you prefer?`;
    }
    return "We've got Batman, Superman, Wonder Woman, The Flash and more DC heroes!";
  }
  
  const sportsKeywords = ['sports', 'football', 'soccer', 'cricket', 'ronaldo', 'messi', 'world cup'];
  if (sportsKeywords.some(k => lastMessage.includes(k))) {
    const sportsProducts = validProducts.filter(p => 
      sportsKeywords.some(k => (p.name + ' ' + p.category).toLowerCase().includes(k))
    );
    if (sportsProducts.length > 0) {
      return `Sports lover! ⚽ ${sportsProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which sport do you follow?`;
    }
    return "We have Ronaldo, Messi, and football trophy keychains!";
  }
  
  if (/price|cost|kitna|kitna hai|rate|kita|kitni|pice/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      const prices = validProducts.map(p => p.price).filter(p => p > 0);
      if (prices.length > 0) {
        return `Our keychains range from Rs ${Math.min(...prices)} to Rs ${Math.max(...prices)}. Most are between Rs 500-700. Great quality! 💪`;
      }
    }
    return "Our keychains are priced between Rs 450-750. Great value!";
  }
  
  if (/shipping|delivery|delivery time|kitne din|bhejna|deliver|charge/i.test(lastMessage)) {
    return `Shipping is just Rs 280 anywhere in Pakistan! 🚚 Delivery takes 5-7 working days. Payment is NayaPay only (account number ${NAYAPAY_ACCOUNT_NUMBER} - ${NAYAPAY_ACCOUNT_NAME}) - no Cash on Delivery.`;
  }
  
  if (/stock|available|in stock|out of stock|hazir|h/i.test(lastMessage)) {
    const withStock = validProducts.filter(p => typeof p.stock === 'number');
    if (withStock.length > 0) {
      const inStock = withStock.filter(p => (p.stock as number) > 0);
      const out = withStock.filter(p => (p.stock as number) <= 0);
      if (inStock.length === 0) {
        return "All items are currently out of stock 😔. Message us on WhatsApp (03143131716) and we'll let you know as soon as they're back!";
      }
      const outNames = out.slice(0, 3).map(p => p.name).join(', ');
      return `We have ${inStock.length} keychains in stock ✅${out.length > 0 ? `. Currently out of stock: ${outNames}` : ''}. Want to see some options?`;
    }
    if (validProducts.length > 0) {
      return `Yes! We have ${validProducts.length} products available. ✅`;
    }
    return "Most items are in stock!";
  }
  
  if (/payment|pay|advance|cash on delivery|cod|easypaisa|jazzcash|nayapay|sadapay|screenshot|transfer|bank/i.test(lastMessage)) {
    return `We take payments on NayaPay only 💳 - NayaPay account number ${NAYAPAY_ACCOUNT_NUMBER} (account name ${NAYAPAY_ACCOUNT_NAME}). After you place the order we contact you on WhatsApp (${HEROIX_WHATSAPP_DISPLAY}). Your order is NOT confirmed until the payment is received - send the payment screenshot on WhatsApp and your order is confirmed and moves forward. No Cash on Delivery.`;
  }
  
  if (/recommend|suggest|best|top|popular|acha|best choice|khush|recommendation|btiye|dikhao/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      const topRated = validProducts.filter(p => p.rating && p.rating >= 4.5);
      if (topRated.length > 0) {
        return `My top picks: ⭐ ${topRated.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Want more?`;
      }
      return `Popular items: 🔥 ${validProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Interested?`;
    }
    return "I'd recommend our anime and superhero collections! They are super popular.";
  }
  
  if (/help|assistance|kaise|how can i|madad|guide/i.test(lastMessage)) {
    return "I can help you: ✅ Browse by category ✅ Check prices ✅ Place orders ✅ Shipping info ✅ Payment methods. Just ask!";
  }
  
  if (/^(yes|yeah|haan|ha|okay|ok|sure|yep)$/i.test(fullMessage.trim())) {
    return "Great! 😊 Tell me which keychain you'd like to order!";
  }
  
  if (/^(no|nope|nah|nahi|nai)$/i.test(fullMessage.trim())) {
    return "No problem! Let me know if you need any help. 😊";
  }
  
  if (validProducts.length > 0) {
    const categories = Array.from(new Set(validProducts.map(p => p.category).filter(Boolean)));
    return `We've got ${validProducts.length} awesome keychains! 🏆 Categories: ${categories.slice(0, 5).join(', ')}. What style do you prefer?`;
  }
  
  if (validProducts.length === 0) {
    return "Welcome to HEROIX! 🔥 We sell Anime, Superhero, Marvel, DC & Sports keychains. Browse our shop!";
  }
  
  return "I'm HEROIX! 🤖 Just tell me what you're looking for - anime, superhero, sports? I can help you find the perfect keychain!";
}
