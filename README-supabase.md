# Supabase Migration Setup Guide

## Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Node.js**: Ensure Node.js is installed (v16 or higher)

## Step 1: Create Supabase Project

1. Log in to your Supabase account
2. Click "New Project"
3. Choose a project name (e.g., "heroix-web")
4. Select a region closest to your users
5. Click "Create Project"

## Step 2: Configure Database

1. Once your project is created, navigate to the "SQL Editor" tab
2. Run the following SQL to create the products table:

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  stock NUMERIC DEFAULT 0,
  description TEXT,
  images JSON,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

3. Enable Row Level Security (RLS) by running:

```sql
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

4. Create a policy to allow public read access:

```sql
CREATE POLICY "Public products select" ON products
  FOR SELECT USING (true);
```

## Step 3: Get Project Credentials

1. In your Supabase project, go to "Settings" → "API"
2. Note down:
   - **Project URL** (Project URL)
   - **anon public key** (anon key)

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

2. Update `.env.local` with your Supabase credentials:

```env
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
ADMIN_EMAILS=admin1@heroix.com,admin2@heroix.com
```

## Step 5: Initialize Database with Products

1. Install dependencies:

```bash
npm install
```

2. Run the setup script:

```bash
npm run setup-supabase
```

This will import the existing products from `products.json` into your Supabase database.

## Step 6: Test the Application

1. Start the development server:

```bash
npm run dev
```

2. Test the following:
   - Product pages load correctly
   - Admin authentication works
   - Product CRUD operations function
   - Real-time updates work across sessions

## Step 7: Deploy to Vercel

1. Set up Vercel deployment
2. Add the same environment variables to your Vercel project settings
3. Deploy and test in production

## Troubleshooting

### Common Issues

1. **Products not loading**: Check Supabase credentials in `.env.local`
2. **Admin authentication failing**: Verify admin emails in `ADMIN_EMAILS`
3. **Database connection errors**: Ensure your Supabase project is running

### Debug Mode

To enable debug logging, temporarily add to your Supabase client:

```typescript
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  schema: "public",
});
```

## Next Steps

1. Set up admin user accounts in Supabase Auth
2. Configure additional security policies
3. Add real-time subscriptions for live updates
4. Implement offline support with local caching

## Support

For Supabase documentation: https://supabase.com/docs
For this project: Contact the development team
