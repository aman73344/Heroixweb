================================================================================
HEROIX - E-commerce Store
AI-Powered Keychain Shopping Experience
================================================================================

## PRODUCT OVERVIEW

HEROIX is a modern e-commerce web application specializing in premium anime,
superhero, Marvel, DC, and sports keychains. The app features an AI-powered
chatbot assistant (HEROIX AI) that helps customers browse products, get
personalized recommendations, and place orders through natural conversation.

Target Market: Pakistan
Payment Method: Cash on Delivery (COD)
Shipping: Rs 250 Nationwide

## TECHNOLOGY STACK

Frontend: Next.js 16.2.0 (App Router), React 19.2.4
Language: TypeScript 5.7.3
UI Components: Radix UI + 57 Shadcn/ui components
Styling: Tailwind CSS 4.2.0
Database: Supabase (PostgreSQL)
AI/LLM: OpenRouter API (Multiple free models)
State Management: React Context API
Forms: React Hook Form + Zod validation
Analytics: Vercel Analytics
Icons: Lucide React
Charts: Recharts

## KEY FEATURES

1. AI CHATBOT ASSISTANT (HEROIX AI)
   - Natural language product discovery and search
   - Conversational order placement flow
   - Multi-step order processing (product -> quantity -> name -> phone ->
     city -> address -> confirmation)
   - Smart product name and alias matching
   - Session-based conversation state management
   - Multi-product orders with quantity detection
   - Fallback responses when AI API is unavailable

2. E-COMMERCE FUNCTIONALITY
   - Product catalog with category filtering (Anime, Superhero, Marvel,
     DC, Sports)
   - Product detail pages with image gallery/carousel
   - Shopping cart (add, remove, update quantities)
   - Checkout flow with shipping form
   - Order management (create, view, update status, delete)
   - Product ratings and reviews display

3. ADMIN DASHBOARD
   - Secure admin authentication (email/password)
   - Product management (add, edit, delete with image upload)
   - Order management (view, filter by status, update status, delete)
   - Real-time statistics and overview

4. USER INTERFACE
   - Dark/Light theme toggle (dark mode default)
   - Responsive mobile-first design
   - Real-time cart badge updates
   - Loading states and error handling
   - Smooth animations and transitions

## PROJECT STRUCTURE

Heroixweb/
|
|--app/ Next.js App Router pages
| |--api/ API routes
| | |--chat/route.ts AI chatbot endpoint
| | |--products/route.ts Product CRUD operations
| | |--orders/route.ts Order management
| | |--test-supabase/ Debug endpoints
| |
| |--admin/ Admin dashboard
| | |--orders/page.tsx Order management page
| | |--products/page.tsx Product management page
| | |--page.tsx Admin login/dashboard
| |
| |--auth/ Authentication pages
| |--checkout/ Checkout flow
| |--products/[id]/ Product detail pages
| |--layout.tsx Root layout
| |--page.tsx Home page
| |--globals.css Global styles
|
|--components/ React components
| |--chat-modal.tsx AI chatbot UI component
| |--theme-provider.tsx Theme management
| |--ui/ Shadcn/ui component library
|
|--lib/ Utility functions and integrations
| |--llm.ts OpenRouter AI integration
| |--cart-context.tsx Shopping cart state management
| |--db.ts Supabase database operations
| |--supabase.ts Supabase client configuration
| |--orders-store.ts Order CRUD operations
| |--server-products.ts Server-side product operations
| |--auth.ts Admin authentication logic
| |--utils.ts Helper functions
|
|--data/ Local data storage
| |--orders.json Order backup (reference only)
|
|--scripts/ Setup and utility scripts
| |--setup-supabase.js Supabase database setup
| |--test-products.js Product testing script
|
|--public/ Static assets
| |--heroix-logo.png Brand logo
| |--anime-bg.jpg Background images
| |--superhero-bg.jpg
|
|--products.json Product catalog (local fallback)
|--.env.example Environment template

## DATABASE SCHEMA

PRODUCTS TABLE:

- id (uuid) Primary key
- name (text) Product name
- category (text) Category (anime/superhero/marvel/dc/sports)
- price (number) Price in PKR
- stock (number) Available stock quantity
- description (text) Product description
- images (text[]) Array of image URLs
- rating (number) Average rating (0-5)
- reviews (number) Total review count
- created_at (timestamp) Creation timestamp
- updated_at (timestamp) Last update timestamp

ORDERS TABLE:

- id (uuid) Primary key
- date (timestamp) Order date
- customer (text) Customer name
- email (text) Customer email
- phone (text) Contact number
- address (text) Delivery address
- city (text) Delivery city
- items_count (number) Number of items ordered
- total (number) Total amount in PKR
- status (text) Order status
- items_data (jsonb) Order items details
- created_at (timestamp) Creation timestamp
- updated_at (timestamp) Last update timestamp

## API ENDPOINTS

CHAT API
POST /api/chat
Body: { message: string, sessionId: string }
Response: { response: string, orderId?: string }

PRODUCTS API
GET /api/products
Query: ?category=string&search=string
Response: Array of product objects

POST /api/products
Body: Product object (name, category, price, stock, description, images)
Response: Created product object

ORDERS API
GET /api/orders
Query: ?status=string
Response: Array of order objects

POST /api/orders
Body: Order object (customer, email, phone, address, city, items, total)
Response: Created order object

PATCH /api/orders
Body: { id: string, status: string }
Response: Updated order object

DELETE /api/orders
Query: ?id=string
Response: { success: boolean }

## INSTALLATION & SETUP

1. Clone the repository:
   git clone <repository-url>
   cd Heroixweb

2. Install dependencies:
   npm install

3. Set up environment variables:
   Copy .env.example to .env.local and configure:
   - SUPABASE_URL (your Supabase project URL)
   - SUPABASE_ANON_KEY (Supabase anonymous key)
   - OPENROUTER_API_KEY (OpenRouter API key for AI chatbot)
   - ADMIN_EMAILS (comma-separated admin emails)

4. Set up Supabase database:
   - Create a new Supabase project at supabase.com
   - Run the setup script:
     node scripts/setup-supabase.js

5. Start the development server:
   npm run dev

6. Access the application:
   - Store: http://localhost:3000
   - Admin: http://localhost:3000/admin

## ADMIN CREDENTIALS

Default admin login:
Email: admin@heroix.com
Password: admin123

Note: Update ADMIN_EMAILS environment variable to add more admin users.

## SHIPPING & PAYMENT

- Payment Method: Cash on Delivery (COD) only
- Shipping Cost: Rs 250 per order (nationwide)
- Product Price Range: Rs 450 - 750

## TROUBLESHOOTING

1. AI Chatbot not responding:
   - Verify OPENROUTER_API_KEY is set correctly
   - Check API quota/credits on OpenRouter dashboard
   - Fallback responses are used when API is unavailable

2. Database connection errors:
   - Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
   - Check Supabase project status and quotas
   - Ensure RLS policies allow anonymous access

3. Image upload fails in admin:
   - Check Supabase storage bucket permissions
   - Verify storage bucket 'products' exists

4. Orders not saving:
   - Verify orders table exists with correct schema
   - Check RLS policies for insert permissions

## PERFORMANCE FEATURES

- Server-side rendering for SEO optimization
- Image optimization with Next.js Image component
- Client-side caching for fast page loads
- Optimistic UI updates for cart operations
- Lazy loading for off-screen components

## SECURITY FEATURES

- Environment variables for sensitive data
- Admin authentication for dashboard access
- Input validation with Zod schemas
- SQL injection prevention via Supabase
- XSS protection via React's built-in escaping

================================================================================
Thank you for using HEROIX!
AI-Powered E-commerce for Keychain Enthusiasts
================================================================================
