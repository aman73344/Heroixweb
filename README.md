# HEROIX - AI-Powered E-commerce Keychain Store

## Overview

HEROIX is a modern, AI-powered e-commerce web application specializing in anime, superhero, and sports keychains. The application features a sophisticated AI chatbot that helps customers browse products, place orders, and get personalized recommendations.

## Key Features

### 🤖 AI Chatbot Assistant

- **Natural Language Processing**: Conversational AI that understands customer requests
- **Product Discovery**: Helps customers find keychains by name, category, or description
- **Order Processing**: Complete order flow with step-by-step guidance
- **Multiple Product Support**: Handles complex orders with multiple items and quantities
- **Smart Quantity Detection**: Automatically detects quantities from phrases like "3 Batman and 2 Joker"

### 🛒 E-commerce Functionality

- **Product Catalog**: Browse anime, Marvel, DC, and sports keychains
- **Shopping Cart**: Add/remove items with real-time price calculations
- **Checkout Flow**: Secure checkout with order confirmation
- **Order Management**: Admin panel for managing orders and customer information

### 🎨 Modern UI/UX

- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark/Light Theme**: Automatic theme switching based on system preferences
- **Product Gallery**: High-quality product images with hover effects
- **Loading States**: Smooth animations and loading indicators

## Technical Architecture

### Frontend

- **Framework**: Next.js 15 with App Router
- **UI Library**: Shadcn/ui components with custom styling
- **State Management**: React Context API for cart and theme
- **Styling**: Tailwind CSS with custom design system
- **TypeScript**: Full type safety throughout the application

### Backend

- **API Routes**: Next.js API routes for chat, products, and orders
- **AI Integration**: OpenRouter API for LLM responses
- **File-based Storage**: JSON files for product and order data
- **Session Management**: In-memory session storage for chat conversations

### AI Components

- **LLM Integration**: OpenRouter API with custom system prompts
- **Product Matching**: Smart regex-based product detection
- **Order Flow**: State machine for handling multi-step order process
- **Fallback Responses**: Graceful degradation when AI API is unavailable

## Project Structure

```
Heroixweb/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── chat/          # AI chatbot endpoint
│   │   ├── products/      # Product management
│   │   └── checkout/      # Order processing
│   ├── admin/             # Admin dashboard
│   ├── auth/              # Authentication pages
│   ├── checkout/          # Checkout flow
│   ├── products/          # Product catalog
│   └── page.tsx           # Home page
├── components/            # Reusable React components
│   ├── chat-modal.tsx     # AI chatbot interface
│   ├── theme-provider.tsx # Theme management
│   └── ui/               # Shadcn/ui components
├── lib/                   # Business logic and utilities
│   ├── llm.ts            # AI chatbot logic
│   ├── products.ts       # Product management
│   ├── orders-store.ts   # Order persistence
│   ├── cart-context.tsx  # Shopping cart state
│   └── utils.ts          # Helper functions
├── data/                 # Static data files
│   └── orders.json       # Order database
├── public/               # Static assets
│   ├── heroix-logo.png   # Brand assets
│   └── placeholder.jpg   # Default images
└── styles/              # Global styles
    └── globals.css       # Main stylesheet
```

## AI Chatbot Features

### Product Discovery

The chatbot can understand various ways customers ask about products:

- "Show me Batman keychains"
- "Do you have anime keychains?"
- "What Marvel products do you have?"

### Order Processing

Complete order flow with intelligent data extraction:

1. **Product Selection**: Detects product names and quantities
2. **Customer Information**: Extracts name, phone, city, and address
3. **Order Confirmation**: Provides summary and confirmation flow
4. **Order Storage**: Saves orders to file-based database

### Smart Pattern Matching

- **Multiple Products**: "I want Batman and Joker keychains"
- **Quantities**: "3 Spider-Man and 2 Iron Man"
- **Flexible Input**: Handles typos, abbreviations, and natural language

### Error Handling

- **Graceful Degradation**: Fallback responses when AI API fails
- **Session Recovery**: Maintains conversation state across requests
- **Input Validation**: Validates phone numbers, cities, and quantities

## Installation & Setup

### Prerequisites

- Node.js 18+
- npm or pnpm package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd Heroixweb

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your OpenRouter API key
```

### Environment Variables

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Running the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# Visit http://localhost:3000
```

## API Endpoints

### Chat API

- **POST** `/api/chat` - Process chat messages and return AI responses
- **Input**: { messages: [], sessionId?: string }
- **Output**: { message: string, sessionId: string }

### Products API

- **GET** `/api/products` - Get all products
- **GET** `/api/products/[id]` - Get specific product
- **POST** `/api/products` - Create new product (admin)

### Orders API

- **GET** `/api/orders` - Get all orders (admin)
- **POST** `/api/orders` - Create new order
- **PUT** `/api/orders/[id]` - Update order status (admin)

## Development

### Adding New Products

1. Edit `products.json` with new product data
2. Products automatically sync with the application
3. No database migrations required

### Customizing the Chatbot

1. Modify system prompt in `lib/llm.ts`
2. Adjust product matching logic in `app/api/chat/route.ts`
3. Test with various customer inputs

### Theme Customization

1. Edit color variables in `styles/globals.css`
2. Update component styles in `components/ui/`
3. Test responsive behavior across devices

## Performance Features

### Optimizations

- **Image Optimization**: Next.js image component with lazy loading
- **Code Splitting**: Automatic bundle splitting by page
- **Caching**: Browser caching for static assets
- **Minification**: Automatic CSS and JS minification in production

### AI Performance

- **Rate Limiting**: Built-in retry logic for API calls
- **Session Management**: Efficient in-memory session storage
- **Fallback Responses**: Quick responses when AI is slow

## Security Features

### Input Validation

- **XSS Protection**: Sanitized user inputs
- **SQL Injection**: No database queries, file-based storage only
- **Rate Limiting**: API rate limiting to prevent abuse

### Data Protection

- **Session Isolation**: Separate sessions for each user
- **No Sensitive Data**: No credit card or payment information stored
- **File Permissions**: Secure file system permissions

## Testing

### Manual Testing

1. Test chatbot with various product queries
2. Verify order flow with multiple products
3. Check responsive design on different devices
4. Test error scenarios and edge cases

### Automated Testing

```bash
# Run linting
npm run lint

# Check TypeScript
npm run type-check

# Format code
npm run format
```

## Deployment

### Vercel (Recommended)

1. Connect repository to Vercel
2. Set environment variables
3. Deploy automatically on git push

### Other Platforms

- **Netlify**: Works with static export
- **Docker**: Containerized deployment available
- **Traditional Hosting**: Standard Node.js deployment

## Troubleshooting

### Common Issues

**Chatbot not responding:**

- Check OpenRouter API key in `.env.local`
- Verify internet connection
- Check browser console for errors

**Products not loading:**

- Verify `products.json` exists in root directory
- Check file permissions
- Restart development server

**Orders not saving:**

- Check `data/` directory exists and is writable
- Verify file permissions
- Check server logs for errors

### Getting Help

- Check the browser developer console for errors
- Verify all environment variables are set
- Ensure Node.js version is compatible
- Review the application logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

- Create an issue on GitHub
- Check the troubleshooting section
- Review the documentation

---

**HEROIX** - Where AI meets e-commerce for the ultimate shopping experience! 🦸‍♂️🛒
