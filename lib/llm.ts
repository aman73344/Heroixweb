// OpenRouter LLM Integration for Heroix AI Sales Assistant
// Properly calls OpenRouter API for natural AI responses

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are HEROIX, a friendly and knowledgeable ecommerce sales assistant for an anime/superhero keychain store in Pakistan. You talk like a helpful shopkeeper, NOT a robot or AI.

IMPORTANT RULES:
- Be conversational, friendly, and natural
- Keep responses SHORT (1-3 sentences)
- NEVER repeat the same phrases or responses
- NEVER say "as an AI" or "according to my knowledge"
- Recommend products when relevant
- Help users place orders step by step
- Ask ONE question at a time when gathering info
- If you don't know something, say so honestly

STORE INFO:
- Products: Anime, Superhero, Marvel, DC, and Sports keychains
- Price range: Rs 450-750
- Shipping: Rs 250 nationwide (5-7 days)
- Payment: Cash on Delivery available
- Location: Pakistan

PRODUCT CATALOG (use this data for recommendations):
{products}

When user wants to order:
1. Ask for product name (if not specified)
2. Ask for quantity
3. Ask for name
4. Ask for phone number
5. Ask for city
6. Ask for full address
7. Confirm order with summary

When user asks about products:
- Search the catalog above
- Mention price, category, and brief description
- Recommend similar items if relevant`;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
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

export async function generateLLMResponse(
  messages: ChatMessage[],
  productContext: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.warn('OpenRouter API key not configured, using fallback');
    return generateFallbackResponse(messages, productContext);
  }

  const systemMessage = SYSTEM_PROMPT.replace('{products}', productContext);
  const maxRetries = 2;
  
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
  model: 'openrouter/free',
          messages: [
            { role: 'system', content: systemMessage },
            ...messages.filter(m => m.role !== 'system')
          ],
          max_tokens: 300,
          temperature: 0.8,
          top_p: 0.9,
        }),
      });

      if (response.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500;
        console.warn(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('OpenRouter API error:', response.status, errorData);
        return generateFallbackResponse(messages, productContext);
      }

      const data: OpenRouterResponse = await response.json();

      if (data.error) {
        console.error('OpenRouter error:', data.error);
        if (attempt < maxRetries) continue;
        return generateFallbackResponse(messages, productContext);
      }

      return data.choices?.[0]?.message?.content?.trim() || 
        generateFallbackResponse(messages, productContext);
    } catch (error) {
      console.error('LLM API call failed:', error);
      if (attempt === maxRetries) return generateFallbackResponse(messages, productContext);
    }
  }
  
  return generateFallbackResponse(messages, productContext);
}

function generateFallbackResponse(messages: ChatMessage[], productContext: string): string {
  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
  
  // Use product catalog for smart responses
  const products = parseProductCatalog(productContext);
  
  if (lastMessage.includes('hi') || lastMessage.includes('hello') || lastMessage.includes('assalam')) {
    return "Hey there! 👋 Welcome to HEROIX! Looking for something specific today?";
  }
  
  if (lastMessage.includes('anime')) {
    const animeProducts = products.filter(p => p.category === 'Anime');
    if (animeProducts.length > 0) {
      return `We have ${animeProducts.length} anime keychains! ${animeProducts.slice(0, 2).map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Which catches your eye?`;
    }
  }
  
  if (lastMessage.includes('marvel') || lastMessage.includes('dc') || lastMessage.includes('superhero')) {
    const superheroProducts = products.filter(p => ['Marvel', 'DC', 'Superhero'].includes(p.category));
    if (superheroProducts.length > 0) {
      return `Great superhero collection! ${superheroProducts.slice(0, 3).map(p => p.name).join(', ')}. Starting from Rs ${Math.min(...superheroProducts.map(p => p.price))}.`;
    }
  }
  
  if (lastMessage.includes('order') || lastMessage.includes('buy') || lastMessage.includes('chahiye')) {
    return "Sure thing! Which keychain would you like to order? Just tell me the name and how many you need!";
  }
  
  if (lastMessage.includes('price') || lastMessage.includes('kitna') || lastMessage.includes('rate')) {
    return `Our keychains range from Rs ${Math.min(...products.map(p => p.price))} to Rs ${Math.max(...products.map(p => p.price))}. Which category interests you?`;
  }
  
  if (lastMessage.includes('shipping') || lastMessage.includes('delivery') || lastMessage.includes('bhejna')) {
    return "Shipping is Rs 250 anywhere in Pakistan. Delivery takes 5-7 working days with tracking!";
  }
  
  if (lastMessage.includes('recommend') || lastMessage.includes('best') || lastMessage.includes('suggest')) {
    const topProducts = [...products].sort(() => Math.random() - 0.5).slice(0, 3);
    return `My top picks: ${topProducts.map(p => `${p.name} (Rs ${p.price})`).join(', ')}. Want more details on any?`;
  }
  
  // Search products by keywords
  const matchedProducts = products.filter(p => 
    p.name.toLowerCase().includes(lastMessage) ||
    p.category.toLowerCase().includes(lastMessage) ||
    p.description?.toLowerCase().includes(lastMessage)
  );
  
  if (matchedProducts.length > 0) {
    return `Found ${matchedProducts.length} matching products: ${matchedProducts.slice(0, 3).map(p => `${p.name} - Rs ${p.price}`).join(', ')}.`;
  }
  
  if (products.length > 0) {
    return `We have ${products.length} products including ${products.slice(0, 3).map(p => p.name).join(', ')}. What are you looking for?`;
  }
  
  return "I'm here to help! Ask me about our keychains, prices, or place an order directly. What would you like?";
}

function parseProductCatalog(catalog: string): Array<{name: string; category: string; price: number; description?: string}> {
  const products: Array<{name: string; category: string; price: number; description?: string}> = [];
  
  const lines = catalog.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    // Match "Product Name (Category): Rs 123" format
    const match = line.match(/^([^(]+)\s*\(([^)]+)\)\s*:?\s*Rs\s*([\d,]+)/);
    if (match) {
      products.push({
        name: match[1].trim(),
        category: match[2].trim(),
        price: parseInt(match[3].replace(/,/g, ''), 10)
      });
    }
  }
  
  return products;
}
