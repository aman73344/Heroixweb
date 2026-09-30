-- ============================================================================
-- HEROIX - Supabase security hardening  (MIGRATION 001)
--
-- STATUS: PREPARED, NOT APPLIED. Requires owner approval before running.
--
-- ⚠️ DO NOT RUN UNTIL THE SERVICE KEY IS CONFIRMED WORKING IN PRODUCTION
--
-- REVIEW FINDING (this is why the file was rewritten before applying):
-- The original draft assumed all server-side writes already used the service
-- role key. Tracing the code proved that FALSE. `lib/supabase.ts` builds its
-- client from the ANON key, and these WRITE paths were all using it:
--
--     lib/db.ts              -> INSERT orders, UPDATE products.stock
--     lib/server-products.ts -> UPSERT / DELETE products
--     app/api/products/route.ts -> UPSERT products
--
-- Those writes only ever worked because `anon` had wide-open write policies.
-- Applying STEP 1/STEP 2 without first moving those writes to the service key
-- would have broken EVERY checkout and EVERY stock decrement in production.
--
-- That has now been fixed in code: those writes use `lib/supabase-admin.ts`
-- (service key), and `node scripts/security-check.mjs` asserts no anon write
-- remains. See "PRE-FLIGHT" below.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- PRE-FLIGHT (do this BEFORE running any SQL below)
-- ----------------------------------------------------------------------------
-- 1. Deploy the current branch to staging and confirm SUPABASE_SERVICE_KEY is set
--    for that environment.
-- 2. Run:  node scripts/security-check.mjs
--    All checks must PASS except the known Phase 2 checkout one.
-- 3. In staging, place ONE real test order end to end and confirm it is stored.
-- 4. Take a backup first: Supabase Dashboard -> Database -> Backups, or
--       pg_dump via the Supabase CLI.
--
-- If any of the above is not done, STOP. Applying this early breaks checkout.


-- ----------------------------------------------------------------------------
-- STEP 1 - products: keep public reads, remove anonymous writes.
-- SAFE once PRE-FLIGHT passes.
-- ----------------------------------------------------------------------------

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public inserts" ON products;
DROP POLICY IF EXISTS "Allow public selects" ON products;
DROP POLICY IF EXISTS "Allow public updates" ON products;
DROP POLICY IF EXISTS "Allow public deletes" ON products;

-- The storefront reads the catalogue from the BROWSER with the anon key, so
-- this policy must exist or the shop shows an empty catalogue.
CREATE POLICY "Allow public selects" ON products
  FOR SELECT TO anon, authenticated USING (true);

-- No anon INSERT/UPDATE/DELETE policy is created on purpose: writes now
-- require the service key (lib/supabase-admin.ts -> /api/admin-products).
REVOKE INSERT, UPDATE, DELETE ON products FROM anon;
GRANT SELECT ON products TO anon;


-- ----------------------------------------------------------------------------
-- STEP 2 - orders: turn RLS back ON, no public access.
-- SAFE once PRE-FLIGHT passes.
-- ----------------------------------------------------------------------------

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous inserts" ON orders;
DROP POLICY IF EXISTS "Allow anonymous select" ON orders;
DROP POLICY IF EXISTS "Allow anonymous update" ON orders;
DROP POLICY IF EXISTS "Allow anonymous delete" ON orders;

-- No policy is created for anon/authenticated. With RLS ON and no matching
-- policy, those roles get nothing - which is the intent. Admin reads/writes
-- (app/api/orders GET/PATCH/DELETE) use the service key and bypass RLS.

REVOKE ALL ON orders FROM anon;


-- ----------------------------------------------------------------------------
-- STEP 3 - storage: STOPPED, DO NOT RUN
-- ----------------------------------------------------------------------------
-- Admin product-photo upload (app/admin/products/page.tsx) still uploads via the
-- BROWSER anon client. Revoking anon INSERT on storage.objects breaks admin
-- uploads. Run the statements below ONLY after that upload has been moved to a
-- server route guarded by requireAdminApi().
--
-- CREATE POLICY "Allow public viewing" ON storage.objects
--   FOR SELECT TO anon, authenticated USING (bucket_id = 'products');
--
-- REVOKE INSERT, UPDATE, DELETE ON storage.objects FROM anon;


-- ----------------------------------------------------------------------------
-- STEP 4 - verification (read-only, safe to run any time)
-- ----------------------------------------------------------------------------

-- Expect exactly ONE row: "Allow public selects" / SELECT.
SELECT policyname, cmd, roles FROM pg_policies
WHERE tablename = 'products' ORDER BY policyname;

-- Expect ZERO rows.
SELECT policyname, cmd, roles FROM pg_policies
WHERE tablename = 'orders';

-- Expect relrowsecurity = true for both.
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('products', 'orders');

-- Expect NO grants for anon beyond SELECT on products.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_name IN ('products', 'orders')
ORDER BY table_name, privilege_type;

-- Existing indexes, so migration 003 does not create duplicates.
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename IN ('products', 'orders');

