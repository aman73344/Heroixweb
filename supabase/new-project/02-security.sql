-- ============================================================================
-- HEROIX - NEW Supabase project setup, STEP 2 of 2: SECURITY + STORAGE
--
-- Run this in the SQL Editor of the NEW project AFTER the data has been seeded
-- (scripts/seed-new-project.mjs --apply). It:
--   STEP 1 - products: public reads only, anonymous writes removed
--   STEP 2 - orders: RLS on, no public access at all
--   STEP 3 - storage: "products" bucket + policies (image uploads)
--   STEP 4 - order-number backfill safety net (no-op, numbers already seeded)
--   STEP 5 - verification queries
--
-- This is migration 001_harden_rls.sql (STEPs 1-2) plus the storage setup.
-- Migration 002's reserve_stock() function is deliberately NOT included: your
-- products.variants column is text[] (not jsonb), so that function would fail
-- at runtime. lib/db.ts detects the missing function and uses its tested
-- guarded-UPDATE fallback, which is safe. Nothing else is needed from 002.
--
-- Re-running this file is safe (DROP POLICY IF EXISTS / ON CONFLICT everywhere).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1 - products: keep public reads, remove anonymous writes.
-- The storefront reads the catalogue from the BROWSER with the publishable
-- key, so the SELECT policy must exist or the shop shows an empty catalogue.
-- Writes now require the service key (lib/supabase-admin.ts).
-- ----------------------------------------------------------------------------

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public inserts" ON products;
DROP POLICY IF EXISTS "Allow public selects" ON products;
DROP POLICY IF EXISTS "Allow public updates" ON products;
DROP POLICY IF EXISTS "Allow public deletes" ON products;

CREATE POLICY "Allow public selects" ON products
  FOR SELECT TO anon, authenticated USING (true);

-- No anon INSERT/UPDATE/DELETE policy is created on purpose.
REVOKE INSERT, UPDATE, DELETE ON products FROM anon;
GRANT SELECT ON products TO anon;


-- ----------------------------------------------------------------------------
-- STEP 2 - orders: RLS on, no public access.
-- With RLS ON and no policy, anon/authenticated get nothing - which is the
-- intent. Admin reads/writes (app/api/orders etc.) use the service key and
-- bypass RLS.
-- ----------------------------------------------------------------------------

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous inserts" ON orders;
DROP POLICY IF EXISTS "Allow anonymous select" ON orders;
DROP POLICY IF EXISTS "Allow anonymous updates" ON orders;
DROP POLICY IF EXISTS "Allow anonymous delete" ON orders;

REVOKE ALL ON orders FROM anon;


-- ----------------------------------------------------------------------------
-- STEP 3 - storage: public "products" bucket for product photos.
--
-- Parity with the old project: the admin panel still uploads from the BROWSER
-- with the publishable(anon) key (app/admin/products/page.tsx), so anon keeps
-- INSERT/UPDATE/DELETE on this one bucket. Known Phase-2 item (from 001
-- STEP 3): once uploads move behind requireAdminApi(), revoke these again.
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Allow public viewing" ON storage.objects;
CREATE POLICY "Allow public viewing" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'products');


DROP POLICY IF EXISTS "Allow anon product image uploads" ON storage.objects;
CREATE POLICY "Allow anon product image uploads" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Allow anon product image updates" ON storage.objects;
CREATE POLICY "Allow anon product image updates" ON storage.objects
  FOR UPDATE TO anon
  USING (bucket_id = 'products')
  WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Allow anon product image deletes" ON storage.objects;
CREATE POLICY "Allow anon product image deletes" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'products');


-- ----------------------------------------------------------------------------
-- STEP 4 - order-number backfill (migration 003 STEP 2).
-- No-op when every order already has its seeded number; only assigns numbers
-- to any row that somehow has none. Oldest first, starting at 1001.
-- ----------------------------------------------------------------------------

WITH numbered AS (
  SELECT
    id,
    1000 + ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS next_number
  FROM orders
  WHERE order_number IS NULL
)
UPDATE orders o
SET order_number = numbered.next_number
FROM numbered
WHERE o.id = numbered.id
  AND o.order_number IS NULL;


-- ----------------------------------------------------------------------------
-- STEP 5 - verification (read-only). Expected results in the comments.
-- ----------------------------------------------------------------------------

-- Expect exactly ONE row: "Allow public selects" / SELECT.
SELECT policyname, cmd, roles FROM pg_policies
WHERE tablename = 'products' ORDER BY policyname;

-- Expect ZERO rows.
SELECT policyname, cmd, roles FROM pg_policies
WHERE tablename = 'orders';

-- Expect relrowsecurity = true for BOTH rows.
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('products', 'orders');

-- Expect anon to hold only SELECT on products, and nothing on orders.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_name IN ('products', 'orders')
ORDER BY table_name, privilege_type;

-- Expect the storage bucket, public = true.
SELECT id, public FROM storage.buckets WHERE id = 'products';

-- Expect: products = seeded product count, orders = 1, unnumbered = 0.
SELECT (SELECT COUNT(*) FROM products) AS products,
       (SELECT COUNT(*) FROM orders) AS orders,
       (SELECT COUNT(*) FROM orders WHERE order_number IS NULL) AS unnumbered;
