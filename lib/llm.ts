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
  
  // If no API key, always use fallback
  if (!apiKey) {
    console.warn('OpenRouter API key not configured, using enhanced fallback');
    return generateEnhancedFallbackResponse(messages, products);
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE(products);
  const maxRetries = 1;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
          model: 'anthropic/claude-3-haiku',
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }))
          ],
          max_tokens: 400,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (response.status === 429) {
        console.warn('Rate limited, using fallback');
        return generateEnhancedFallbackResponse(messages, products);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenRouter API error:', response.status, errorData);
        return generateEnhancedFallbackResponse(messages, products);
      }

      const data: OpenRouterResponse = await response.json();

      if (data.error) {
        console.error('OpenRouter error:', data.error.message);
        return generateEnhancedFallbackResponse(messages, products);
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      if (content && content.length > 5) return content;
      
      return generateEnhancedFallbackResponse(messages, products);
    } catch (error: any) {
      console.error('LLM API call failed:', error.message);
      return generateEnhancedFallbackResponse(messages, products);
    }
  }
  
  return generateEnhancedFallbackResponse(messages, products);
}

function generateEnhancedFallbackResponse(messages: ChatMessage[], products: Product[]): string {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const fullMessage = messages[messages.length - 1]?.content || '';
  
  // Ensure products array is valid
  const validProducts = Array.isArray(products) && products.length > 0 ? products : [];
  
  // Greeting patterns
  if (/^(hi|hello|hey|assalam|asalam|khair|salaam|good morning|good evening)/i.test(fullMessage)) {
    return "Hey there! Welcome to HEROIX! We have amazing anime, superhero & sports keychains. What would you like to see?";
  }
  
  // Thank you patterns
  if (/thanks|thank you|shukriya|mersh/i.test(lastMessage)) {
    return "You're welcome! Is there anything else I can help you with?";
  }
  
  // Order/buy intent
  if (/order|buy|chahiye|mangta|leni|chaiye|bhej|bhejna/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      return `Great! We have ${validProducts.length} amazing keychains. Just tell me the name of the keychain you want and how many!`;
    }
    return "I'd love to help you order! Browse our shop and tell me which keychain catches your eye!";
  }
  
  // Anime category - expanded search
  if (/anime|naruto|one piece|dragon ball|z|attack on titan|demon slayer|jujutsu|evangelion|bleach|aot/i.test(lastMessage)) {
    const animeProducts = validProducts.filter(p => 
      /anime|naruto|one piece|dragon ball|attack on titan|demon slayer|jujutsu|evangelion|bleach/i.test((p.name + ' ' + p.category).toLowerCase())
    );
    if (animeProducts.length > 0) {
      return `Anime fan! Check out: ${animeProducts.slice(0, 3).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which one do you like?`;
    }
    return "We have tons of anime keychains - Naruto, One Piece, Demon Slayer, Dragon Ball Z and more! Browse our Anime category!";
  }
  
  // Marvel category
  if (/marvel|iron man|spider|spiderman|thor|captain america|avenger/i.test(lastMessage)) {
    const marvelProducts = validProducts.filter(p => 
      /marvel|iron|spider|thor|captain|avenger/i.test((p.name + ' ' + p.category).toLowerCase())
    );
    if (marvelProducts.length > 0) {
      return `Marvel fan! We've got: ${marvelProducts.slice(0, 3).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which hero is your favorite?`;
    }
    return "We've got Iron Man, Spider-Man, Thor, Captain America and more Marvel heroes! Check our Marvel category.";
  }
  
  // DC/Superhero category
  if (/dc|batman|superman|wonder woman|flash|aquaman|justice league/i.test(lastMessage)) {
    const dcProducts = validProducts.filter(p => 
      /dc|batman|superman|flash|aquaman|wonder/i.test((p.name + ' ' + p.category).toLowerCase())
    );
    if (dcProducts.length > 0) {
      return `DC fan! Check out: ${dcProducts.slice(0, 3).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which hero do you prefer?`;
    }
    return "We've got Batman, Superman, Wonder Woman, The Flash and more DC heroes! Browse our DC/Superhero category.";
  }
  
  // Sports category
  if (/sports|football|soccer|cricket|ronaldo|messi|ronaldinho|cristiano/i.test(lastMessage)) {
    const sportsProducts = validProducts.filter(p => 
      /sports|football|soccer|cricket|ronaldo|messi/i.test((p.name + ' ' + p.category).toLowerCase())
    );
    if (sportsProducts.length > 0) {
      return `Sports lover! Check out: ${sportsProducts.slice(0, 3).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which sport do you follow?`;
    }
    return "We have Ronaldo, Messi, and football trophy keychains! Browse our Sports category.";
  }
  
  // Price inquiry
  if (/price|cost|kitna|kitna hai|rate|kita/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      const prices = validProducts.map(p => p.price).filter(p => p > 0);
      if (prices.length > 0) {
        return `Our keychains range from Rs ${Math.min(...prices)} to Rs ${Math.max(...prices)}. Most are between Rs 500-700. What category interests you?`;
      }
    }
    return "Our keychains are priced between Rs 450-750. Great value for premium quality!";
  }
  
  // Shipping/delivery
  if (/shipping|delivery|delivery time|kitne din|bhejna|deliver|charge/i.test(lastMessage)) {
    return "Shipping is just Rs 250 anywhere in Pakistan! Delivery takes 5-7 working days. Cash on delivery available!";
  }
  
  // Stock/inventory
  if (/stock|available|in stock|out of stock|hazir/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      return `Yes! We have ${validProducts.length} products in stock. All items are ready to ship!`;
    }
    return "Most items are in stock! Browse our shop to see what's available.";
  }
  
  // Payment methods
  if (/payment|pay|cash on delivery|cod|easypaisa|jazzcash|bank/i.test(lastMessage)) {
    return "We accept Cash on Delivery (COD) - pay when you receive! Bank transfer, JazzCash and EasyPaisa also available.";
  }
  
  // Recommendation
  if (/recommend|suggest|best|top|popular|acha|best choice|khush|recommendation/i.test(lastMessage)) {
    if (validProducts.length > 0) {
      const topRated = validProducts.filter(p => p.rating && p.rating >= 4.5);
      if (topRated.length > 0) {
        return `My top picks: ${topRated.slice(0, 3).map(p => `${p.name} (Rs ${p.price}) ⭐${p.rating}`).join(', ')}. Want more details?`;
      }
      return `Popular items: ${validProducts.slice(0, 3).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Interested?`;
    }
    return "I'd recommend our anime and superhero collections! They are super popular. What style do you like?";
  }
  
  // Help
  if (/help|assistance|kaise|how can i/i.test(lastMessage)) {
    return "I can help you: Browse products by category, Check prices, Place orders, Shipping info, Payment methods. Just ask!";
  }
  
  // Product search - look for any matching text
  if (validProducts.length > 0) {
    const searchTerms = lastMessage.split(/\s+/).filter(w => w.length > 2);
    const matchedProducts = validProducts.filter(p => {
      const productText = (p.name + ' ' + p.category + ' ' + (p.description || '')).toLowerCase();
      return searchTerms.some(term => productText.includes(term));
    });
    
    if (matchedProducts.length > 0) {
      return `Found ${matchedProducts.length} products: ${matchedProducts.slice(0, 4).map(p => `${p.name} - Rs ${p.price}`).join(', ')}. Which one interests you?`;
    }
  }
  
  // Catalog overview
  if (validProducts.length > 0) {
    const categories = [...new Set(validProducts.map(p => p.category).filter(Boolean))];
    return `We've got ${validProducts.length} keychains! Categories: ${categories.slice(0, 5).join(', ')}. What style do you prefer?`;
  }
  
  // Default response
  return "I'm HEROIX, your shopping assistant! Browse our keychains by category or just tell me what you're looking for - anime, superhero, sports?";
}
