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
Payment Method: NayaPay only (Account Number: 03084824939, Account Name: Khawaja Aman Ali — WhatsApp +92 314 3131716). Orders are confirmed only after the payment is received.
Shipping: Rs 280 Nationwide (delivery charge)

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
   - Multi-design products: every variant (e.g. Vegeta Base Form / Super
     Saiyan / Super Saiyan Blue) has its OWN picture, optional description,
     stock count and its own Add to Cart button - all at the same price
   - Shopping cart (add, remove, update quantities, per variant)
   - Checkout flow with shipping form
   - Order management (create, view, update status, delete)
   - Product ratings and reviews display

3. ADMIN DASHBOARD (private)
   - Hidden entry point + signed httpOnly session cookie (email/password)
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
|--proxy.ts Hides + protects the admin area (signed session check)
|
|--app/ Next.js App Router pages
| |--api/ API routes
| | |--chat/route.ts AI chatbot endpoint
| | |--products/route.ts Product CRUD operations
| | |--orders/route.ts Order management
| | |--test-supabase/ Debug endpoints
| |
| |--admin/ Private admin dashboard (hidden - session required)
| | |--orders/page.tsx Order management page
| | |--products/page.tsx Product management page
| | |--settings/page.tsx Store & chatbot settings
| | |--layout.tsx Server-side session guard + admin navbar
| | |--page.tsx Dashboard
| |
| |--heroix-gate/ Secret owner sign-in page (never linked, noindex)
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
| |--auth.ts Admin credential check (environment variables)
| |--admin-session.ts Signed admin session token (HMAC-SHA256)
| |--admin-guard.ts Server-side admin session guard for APIs
| |--utils.ts Helper functions
|
|--data/ Local data storage
| |--orders.json Order backup (reference only)
|
|--scripts/ Setup and utility scripts
| |--setup-supabase.js Supabase database setup
| |--test-products.js Product testing script
| |--generate-image-derivatives.mjs Builds the WebP thumbnails the site downloads
|
|--public/ Static assets
| |--heroix-logo.png Brand logo
| |--anime-bg.webp Background images
| |--superhero-bg.webp
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

3. Set up environment variables in .env.local:
   Copy `.env.example` to `.env.local` and fill in the values:

   | Variable | Required | Purpose |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL (inlined into the client bundle at build time) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon/publishable key (safe to expose) |
   | `SUPABASE_SERVICE_KEY` | yes | Supabase **service role** key - server only, bypasses RLS. Used by the admin product APIs and image upload. Never prefix with `NEXT_PUBLIC_` |
   | `SUPABASE_URL` / `SUPABASE_ANON_KEY` | no | Server-side duplicates of the two values above. If omitted the `NEXT_PUBLIC_` pair is used automatically |
   | `OPENROUTER_API_KEY` | yes | OpenRouter key for the AI chatbot. Without it the chat replies with canned fallbacks |
   | `NEXT_PUBLIC_APP_URL` | no | Public origin, sent as the `HTTP-Referer` header to OpenRouter |
   | `ADMIN_EMAIL` | yes | Email accepted by `/heroix-gate` |
   | `ADMIN_EMAILS` | no | Extra admin emails, comma separated |
   | `ADMIN_PASSWORD` | yes | Admin password - choose your own |
   | `ADMIN_SESSION_SECRET` | yes | Random string (16+ chars) that signs the session cookie. If missing, the admin area fails closed and login reports the problem |

   Restart the dev server after changing any of them.

4. Set up Supabase database:
   - Create a new Supabase project at supabase.com
   - Run the setup script:
     node scripts/setup-supabase.js

5. Start the development server:
   npm run dev

6. Access the application:
   - Store: http://localhost:3000
   - Private admin area: http://localhost:3000/heroix-gate (see below)

## QUALITY CHECKS

Before pushing, run these - all three are expected to be silent/clean:

```bash
npm run lint      # ESLint 9 + eslint-config-next (flat config: eslint.config.mjs)
npx tsc --noEmit  # TypeScript, zero errors
npm run build     # production build
```

Notes:
- ESLint runs on `eslint.config.mjs`. Rules that conflict with the way this
  codebase is written on purpose (`no-explicit-any`, `no-img-element`, the React
  Compiler `react-hooks/purity` family) are switched off there with comments.
- `npm run dev` writes its log to `.next/dev/logs/next-development.log`; a stale
  error from an earlier edit can linger there, so restart the dev server if the
  terminal still shows an old error.
- On Windows the console is UTF-8 via `.vscode/settings.json`. If you use your
  own PowerShell, run `chcp 65001` first, otherwise the build/lint output shows
  mojibake instead of the ✓ / ○ characters. The permanent fix is the registry
  value below - `.vscode/settings.json` alone is not enough, because a dev
  server started *before* the profile existed keeps the old console:

  ```powershell
  # Makes every NEW console window / VS Code terminal UTF-8 by default
  New-ItemProperty -Path 'HKCU:\Console' -Name 'CodePage' -Value '65001' -PropertyType String -Force
  ```

  Close and reopen all terminals (and restart `npm run dev`) afterwards.

## DEPLOYING TO VERCEL

The project is a standard Next.js 16 App Router app, so Vercel detects it
automatically - there is no `vercel.json` to maintain. Only one manual step is
needed: the environment variables.

1. Import/connect the repository in Vercel and let the framework preset
   "Next.js" be detected. Build command `npm run build`, install command
   `npm install`, output directory: leave empty (Vercel handles `.next`).

2. Add the environment variables under
   **Project -> Settings -> Environment Variables** - the same set as the table
   in "INSTALLATION & SETUP" above:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`  <- mark as **Sensitive**
   - `SUPABASE_URL`          <- optional duplicate
   - `SUPABASE_ANON_KEY`     <- optional duplicate
   - `OPENROUTER_API_KEY`    <- mark as **Sensitive**
   - `NEXT_PUBLIC_APP_URL`   <- set to the production origin, e.g.
     `https://your-app.vercel.app`
   - `ADMIN_EMAIL`
   - `ADMIN_EMAILS`          <- optional
   - `ADMIN_PASSWORD`        <- mark as **Sensitive**
   - `ADMIN_SESSION_SECRET`  <- mark as **Sensitive**, 16+ characters

   Which environment to pick: for Preview, set them on **Preview**; for the
   production deploy, set them on **Production**. Setting "All" is fine for a
   single-developer deployment and avoids a broken preview build.

3. Redeploy from the dashboard (or push again). Every push to `main` triggers a
   new production deployment automatically.

Important Vercel specifics:
- The two `NEXT_PUBLIC_*` values are **inlined into the JavaScript bundle at
  build time**. Changing them on Vercel requires a new build - a plain restart
  is not enough. That is why they must exist when the build runs.
- The admin area is guarded by `proxy.ts` and the session cookie, so after the
  first Vercel deployment the `/admin` routes stay locked until
  `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` are set. Without
  `ADMIN_SESSION_SECRET` (16+ chars) login refuses to issue a cookie.
- `SUPABASE_SERVICE_KEY` must be the **service role** key, not the anon key,
  otherwise the admin product/image endpoints fail with a permission error.
- If the terminal prints the wrong characters locally, that is a console code
  page issue, not an app problem - see "QUALITY CHECKS".

## PRIVATE ADMIN AREA

The admin dashboard is hidden from customers:

- No "Admin" link exists anywhere on the storefront.
- /admin and /heroix-gate are excluded from search engines, and /admin sends
  visitors back to the home page unless a valid signed session cookie is present
  (so the admin area looks like it does not exist).
- Sign in only through the private entry point: /heroix-gate
- Sessions are HMAC-SHA256 signed, httpOnly cookies and expire after 12 hours.
- Admin-only APIs (/api/admin-products, order status updates/deletes and the
  debug endpoints) return 401 without a valid session.

Credentials come from environment variables - never from the code:

   ADMIN_EMAIL=you@example.com
   ADMIN_PASSWORD=your-own-password
   ADMIN_SESSION_SECRET=a-long-random-string

Set these in .env.local (it is git-ignored), change the password to your own,
then restart the dev server. If ADMIN_SESSION_SECRET is missing the admin area
stays locked (fails closed) and the login endpoint reports it.

## PRODUCT DESIGNS (VARIANTS) WITH THEIR OWN PICTURES

A keychain can be sold in several designs. Admin -> Products -> edit a product
-> "Variants / Designs with Stock", one design per line:

    Vegeta Base Form: 5                                        <- design + stock
    Vegeta Super Saiyan: 4 | image: https://.../ssj.png        <- + its own picture
    Vegeta Super Saiyan Blue: 3 | image: https://.../blue.png | desc: Blue haired god form

- Upload the picture for each design in the "Pictures & Descriptions for Each
  Variant / Design" panel right below the variants box (it uploads to Supabase
  storage and keeps the "| image: url" part in sync).
- The description box under each design picture is stored as "| desc: ...".
- All designs share the product price; each design keeps its own stock counter.
- On the product page the customer gets a "Choose Your Design" gallery: one card
  per design with its picture, description, stock pill and its own Add to Cart
  button. Selecting a card switches the big product image to that design.

## SHIPPING & PAYMENT

- Payment Method: NayaPay only — Account Number 03084824939 (Account Name: Khawaja Aman Ali). HEROIX contacts the customer on WhatsApp (+92 314 3131716); an order is NOT confirmed until the payment is received, then it moves forward. No Cash on Delivery.
- Shipping Cost: Rs 280 per order (nationwide delivery charge)
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

## IMAGE LOADING (thumbnails first, gallery on demand)

Supabase Storage is where nearly all of this site's bandwidth goes, and its
free-plan egress allowance is small. The rule the whole app now follows is:

> **Listing pages download thumbnails. The product page downloads the gallery.**

### Why not Supabase image transformations?

`/storage/v1/render/image/public/...` was tried against this project and
answered **HTTP 403 "Image Transformations are not allowed"** - it is a paid
feature and this project is on the free plan. There is no second image service
in the project, so the smaller files have to exist before they are requested.

### How it works

`npm run images:optimize` (`scripts/generate-image-derivatives.mjs`) walks the
catalogue, re-encodes every picture to WebP at the widths in
`lib/image-url.ts` (`400` and `800`), and uploads the result next to the
original inside the same public bucket:

```
original    .../object/public/products/prod-17/1776162067135-1.jpeg   ~785 KB
thumbnail   .../object/public/_thumbs/products/prod-17/...@400.webp    ~62 KB
gallery     .../object/public/_thumbs/products/prod-17/...@800.webp   ~273 KB
```

The derivatives are uploaded with `cache-control: max-age=31536000`, so the
browser and the CDN stop re-asking for them. Nothing is deleted and no original
is modified - removing the `_thumbs/` folder reverts the whole optimisation.

### Which pictures may be downloaded

| Where | What is downloaded |
| --- | --- |
| Product card (home, related products) | the picture on screen + the next one, as WebP derivatives |
| Design chip strip, cart lines, design cards | 400px thumbnail only |
| Product gallery | 400px preview, then the 800px picture fades in over it |
| Gallery pictures further away | not mounted, so not requested, until the customer goes there |
| Variant (design) galleries | only the selected design's |

A picture that is merely transparent, behind another slide or one carousel step
away **is still downloaded** by the browser. That is why the rule is expressed
as *mounted or not mounted*, not as `loading="lazy"` - and why
`loading="lazy"` on its own was never going to fix this.

### Adding a product?

Run `npm run images:optimize` again. It skips anything already generated, so a
re-run only picks up new pictures. Until you do, the missing thumbnail is
noticed at runtime and the original is used instead - the page still works.

### Verifying it

Chrome DevTools -> Network -> filter `supabase.co`:

- Home page: one small WebP per card, `loading="lazy"`, no `.jpeg` originals.
- Product page: the 400px preview and the 800px picture for the selected
  picture, then nothing more until you tap the arrow.


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
