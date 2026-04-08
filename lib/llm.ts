// OpenRouter LLM Integration for Heroix AI Sales Assistant
// Properly calls OpenRouter API for natural AI responses

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

const SYSTEM_PROMPT_TEMPLATE = (products: Product[]) => `You are HEROIX, a friendly ecommerce sales assistant for an anime/superhero keychain store in Pakistan. Be conversational, helpful, and guide customers to purchases.

STORE INFO:
- We sell Anime, Superhero, Marvel, DC, and Sports keychains
- Prices: Rs 450-750 (cash on delivery)
- Shipping: Rs 250 nationwide (5-7 days)
- Based in Pakistan

PRODUCT CATALOG:
${products.length > 0 
  ? products.map(p => `- ${p.name} (${p.category}): Rs ${p.price} - ${p.description || 'Premium quality keychain'}`).join('\n')
  : 'No products currently available'
}

IMPORTANT ORDER FLOW:
When customer wants to order:
1. Ask for product name (check catalog above)
2. Ask for QUANTITY (always ask "How many do you need?")
3. Ask for name
4. Ask for phone number
5. Ask for city
6. Ask for full address
7. Confirm order with summary and ask "Reply yes to confirm"

RULES:
- Keep responses SHORT (1-2 sentences)
- ALWAYS ask for quantity when ordering
- List specific products with prices when asked
- Use Pakistani Rupees (Rs) for prices
- NEVER say "as an AI" or similar`;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export async function generateLLMResponse(
  messages: ChatMessage[],
  products: Product[]
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.log('No API key, using fallback');
    return generateEnhancedFallbackResponse(messages, products);
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE(products);
  
  // Try multiple free models
  const models = [
    'google/gemini-2.0-flash',
    'mistralai/mistral-7b-instruct',
    'meta-llama/llama-3.2-3b-instruct',
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
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data: OpenRouterResponse = await response.json();
        
        if (data.error) {
          console.log(`Model ${model} error:`, data.error.message);
          continue;
        }
        
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content && content.length > 5) {
          console.log(`Using model: ${model}`);
          return content;
        }
      } else {
        const errorText = await response.text();
        console.log(`Model ${model} failed:`, response.status, errorText.substring(0, 200));
      }
    } catch (error: any) {
      console.log(`Model ${model} exception:`, error.message);
    }
  }
  
  console.log('All LLM models failed, using fallback');
  return generateEnhancedFallbackResponse(messages, products);
}

function generateEnhancedFallbackResponse(messages: ChatMessage[], products: Product[]): string {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const fullMessage = messages[messages.length - 1]?.content || '';
  
  // Ensure products array is valid
  const validProducts = Array.isArray(products) && products.length > 0 ? products : [];
  
  // Find products that match the message
  const findMatchingProducts = (searchTerms: string[]) => {
    if (validProducts.length === 0) return [];
    return validProducts.filter(p => {
      const searchText = (p.name + ' ' + p.category + ' ' + (p.description || '')).toLowerCase();
      return searchTerms.some(term => searchText.includes(term.toLowerCase()));
    });
  };
  
  // Extract product name from message
  const extractProductNames = () => {
    const words = lastMessage.split(/\s+/);
    const matched: Product[] = [];
    
    for (const product of validProducts) {
      const productNameLower = product.name.toLowerCase();
      // Check if product name or parts of it appear in message
      if (productNameLower.split(/\s+/).every(word => word.length > 2 && words.includes(word))) {
        matched.push(product);
      }
    }
    return matched;
  };
  
  // Greeting patterns
  if (/^(hi|hello|hey|assalam|asalam|khair|salaam|good morning|good evening|hy|heya)/i.test(fullMessage)) {
    return "Hey there! 👋 Welcome to HEROIX! We have amazing anime, superhero & sports keychains. Just tell me what you're looking for!";
  }
  
  // Thank you patterns
  if (/thanks|thank you|shukriya|mersh|thnx/i.test(lastMessage)) {
    return "You're welcome! 😊 Is there anything else I can help you with?";
  }
  
  // Order/buy intent
  if (/order|buy|chahiye|mangta|leni|chaiye|bhej|bhejna|lagana|order karna/i.test(lastMessage)) {
    const matchedProducts = extractProductNames();
    if (matchedProducts.length > 0) {
      return `Great! I found ${matchedProducts.length} matching keychain(s): ${matchedProducts.slice(0, 5).map(p => p.name).join(', ')}. Which one(s) do you want and how many?`;
    }
    if (validProducts.length > 0) {
      return `We have ${validProducts.length} amazing keychains! Tell me the name of the keychain you want.`;
    }
    return "I'd love to help you order! Tell me which keychain catches your eye!";
  }
  
  // Asking about a specific product
  const matchedProducts = extractProductNames();
  if (matchedProducts.length > 0) {
    const p = matchedProducts[0];
    return `Yes! We have ${p.name} for Rs ${p.price}. Want to order? Just tell me how many you need!`;
  }
  
  // Search for products by keywords
  const searchTerms = lastMessage.split(/\s+/).filter(w => w.length > 2);
  const searchResults = findMatchingProducts(searchTerms);
  if (searchResults.length > 0) {
    return `Found these for you: ${searchResults.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which one interests you?`;
  }
  
  // Anime category
  if (/anime|naruto|one piece|dragon ball|z|attack on titan|demon slayer|jujutsu|evangelion|bleach|aot|cosplay/i.test(lastMessage)) {
    const animeProducts = validProducts.filter(p => 
      /anime|naruto|one piece|dragon ball|attack on titan|demon slayer|jujutsu|evangelion|bleach/i.test((p.name + ' ' + p.category).toLowerCase())
    );
    if (animeProducts.length > 0) {
      return `Anime fan! 🎌 Check out: ${animeProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which one do you like?`;
    }
    return "We have tons of anime keychains - Naruto, One Piece, Demon Slayer, Dragon Ball Z and more!";
  }
  
  // Marvel category
  if (/marvel|iron man|spider|spiderman|thor|captain america|avenger|xmen/i.test(lastMessage)) {
    const marvelProducts = validProducts.filter(p => 
      /marvel|iron|spider|thor|captain|avenger/i.test((p.name + ' ' + p.category).toLowerCase())
    );
    if (marvelProducts.length > 0) {
      return `Marvel fan! 🦸 Check out: ${marvelProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which hero is your favorite?`;
    }
    return "We've got Iron Man, Spider-Man, Thor, Captain America and more Marvel heroes!";
  }
  
  // DC/Superhero category
  if (/dc|batman|superman|wonder woman|flash|aquaman|justice league|joker|batarang/i.test(lastMessage)) {
    const dcProducts = validProducts.filter(p => 
      /dc|batman|superman|flash|aquaman|wonder/i.test((p.name + ' ' + p.category).toLowerCase())
    );
    if (dcProducts.length > 0) {
      return `DC fan! 🦇 Check out: ${dcProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which hero do you prefer?`;
    }
    return "We've got Batman, Superman, Wonder Woman, The Flash and more DC heroes!";
  }
  
  // Sports category
  if (/sports|football|soccer|cricket|ronaldo|messi|ronaldinho|cristiano|football trophy|world cup/i.test(lastMessage)) {
    const sportsProducts = validProducts.filter(p => 
      /sports|football|soccer|cricket|ronaldo|messi/i.test((p.name + ' ' + p.category).toLowerCase())
    );
    if (sportsProducts.length > 0) {
      return `Sports lover! ⚽ Check out: ${sportsProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which sport do you follow?`;
    }
    return "We have Ronaldo, Messi, and football trophy keychains!";
  }
  
  // Price inquiry
  if (/price|cost|kitna|kitna hai|rate|kita|kitni|pice/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      const prices = validProducts.map(p => p.price).filter(p => p > 0);
      if (prices.length > 0) {
        return `Our keychains range from Rs ${Math.min(...prices)} to Rs ${Math.max(...prices)}. Most are between Rs 500-700. Great quality for the price! 💪`;
      }
    }
    return "Our keychains are priced between Rs 450-750. Great value for premium quality!";
  }
  
  // Shipping/delivery
  if (/shipping|delivery|delivery time|kitne din|bhejna|deliver|charge|kaabon|arha|pahunch/i.test(lastMessage)) {
    return "Shipping is just Rs 250 anywhere in Pakistan! 🚚 Delivery takes 5-7 working days. Cash on delivery available!";
  }
  
  // Stock/inventory
  if (/stock|available|in stock|out of stock|hazir|h?|mana|maila/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      return `Yes! We have ${validProducts.length} products in stock. ✅ All items are ready to ship!`;
    }
    return "Most items are in stock! Browse our shop to see what's available.";
  }
  
  // Payment methods
  if (/payment|pay|cash on delivery|cod|easypaisa|jazzcash|bank|paisa|rupiya/i.test(lastMessage)) {
    return "We accept Cash on Delivery (COD) 💵 - pay when you receive! Bank transfer, JazzCash and EasyPaisa also available.";
  }
  
  // Recommendation
  if (/recommend|suggest|best|top|popular|acha|best choice|khush|recommendation|btiye|dikhao/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      const topRated = validProducts.filter(p => p.rating && p.rating >= 4.5);
      if (topRated.length > 0) {
        return `My top picks: ⭐ ${topRated.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Want more details?`;
      }
      return `Popular items: 🔥 ${validProducts.slice(0, 4).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Interested?`;
    }
    return "I'd recommend our anime and superhero collections! They are super popular. What style do you like?";
  }
  
  // Help
  if (/help|assistance|kaise|how can i|madad|guide/i.test(lastMessage)) {
    return "I can help you: ✅ Browse products by category ✅ Check prices ✅ Place orders ✅ Shipping info ✅ Payment methods. Just ask!";
  }
  
  // Quantity/How many
  if (/how many|kitne|quantity|kita|adad/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      return `We have ${validProducts.length} different keychains available! Tell me which one you want.`;
    }
    return "Just tell me which keychain you like and I'll help you order!";
  }
  
  // Catalog overview
  if (validProducts.length > 0) {
    const categories = [...new Set(validProducts.map(p => p.category).filter(Boolean))];
    return `We've got ${validProducts.length} awesome keychains! 🏆 Categories: ${categories.slice(0, 5).join(', ')}. What style do you prefer?`;
  }
  
  // Yes/No responses
  if (/^(yes|yeah|haan|ha|okay|ok|sure|yep)$/i.test(fullMessage.trim())) {
    return "Great! 😊 Tell me which keychain you'd like to order!";
  }
  
  if (/^(no|nope|nah|nahi|nai)$/i.test(fullMessage.trim())) {
    return "No problem! Let me know if you need any help. 😊";
  }
  
  // Catalog overview when no products
  if (validProducts.length === 0) {
    return "Welcome to HEROIX! 🔥 We sell Anime, Superhero, Marvel, DC & Sports keychains. Browse our shop to see what's available!";
  }
  
  // Default response
  return "I'm HEROIX, your shopping assistant! 🤖 Just tell me what you're looking for - anime, superhero, sports? I can help you find the perfect keychain!";
}
