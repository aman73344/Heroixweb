-- ============================================================================
-- HEROIX - NEW Supabase project setup, STEP 1 of 2: SCHEMA
--
-- Run this ONCE in the SQL Editor of the NEW project (qfbotuvlwikbcvqzlguc).
-- Then run scripts/seed-new-project.mjs to load the data, then run
-- 02-security.sql to lock the tables down. Order matters:
--
--   1. This file  (tables, RLS deliberately still OFF)
--   2. node scripts/seed-new-project.mjs --apply
--   3. 02-security.sql
--
-- WHY RLS IS OFF HERE: seeding happens over the REST API with the publishable
-- key. 02-security.sql enables RLS and removes anonymous write access, so this
-- window of openness only exists until step 3. Do step 3 promptly.
--
-- Schema matches the old project exactly (verified against an
-- information_schema export of every column, type, nullability and default):
--   products: id PK, name, category, price, stock, description, images, image,
--             instock, rating, reviews, created_at, updated_at, image_urls,
--             features, variants
--   orders:   id PK, date, customer, email, phone, address, city, items, total,
--             status, items_data, created_at, order_number
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  category    text NOT NULL,
  price       numeric NOT NULL,
  stock       numeric DEFAULT 0,
  description text,
  images      json,
  image       text,
  instock     boolean DEFAULT true,
  rating      numeric DEFAULT 4.5,
  reviews     numeric DEFAULT 0,
  created_at  timestamp without time zone DEFAULT now(),
  updated_at  timestamp without time zone DEFAULT now(),
  image_urls  text[],
  features    text[] DEFAULT ARRAY[]::text[],
  variants    text[] DEFAULT ARRAY[]::text[]
);

CREATE TABLE IF NOT EXISTS public.orders (
  id           text PRIMARY KEY,
  date         text,
  customer     text,
  email        text,
  phone        text,
  address      text,
  city         text,
  items        integer,
  total        real,
  status       text,
  items_data   jsonb,
  created_at   timestamp without time zone DEFAULT now(),
  order_number integer
);

-- ----------------------------------------------------------------------------
-- Indexes: mirrors migration 002 STEP 2 (dashboard query performance) and
-- 003 STEP 3 (unique customer-facing order number - the checkout's
-- "insert, retry with the next number on collision" logic depends on this).
-- IF NOT EXISTS makes re-running this file safe.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_created_at
  ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category
  ON public.products (category);
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key
  ON public.orders (order_number)
  WHERE order_number IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Grants: the seed script writes over REST as the anon role while RLS is off.
-- 02-security.sql revokes anon write access again afterwards.
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON public.products TO anon, authenticated, service_role;
GRANT ALL ON public.orders  TO anon, authenticated, service_role;

-- Success check: expect TWO rows (orders, products).
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('products', 'orders')
ORDER BY table_name;
