-- ============================================================================
-- HEROIX - Checkout integrity  (MIGRATION 002)
--
-- STATUS: PREPARED, NOT APPLIED.
-- Apply to STAGING FIRST. Do NOT apply to production until staging load tests
-- and the checkout flood test have been reviewed.
--
-- WHAT THIS ADDS
--   reserve_stock(jsonb) - reserves every line of an order in ONE transaction
--   with row-level locking, so two customers buying the last unit at the same
--   moment cannot both succeed.
--
-- HOW IT INTERACTS WITH THE APPLICATION
--   lib/db.ts `reserveStock()` calls this function first. If the function does
--   not exist it detects the error code (42883 / PGRST202) and falls back to a
--   compare-and-swap update, which is also safe against the oversell race for a
--   product's total stock.
--
--   So this migration is an UPGRADE in safety, not a prerequisite for
--   correctness. The checkout is already protected without it. Applying it adds:
--     - all-or-nothing behaviour across a multi-line order
--     - per-design (variant) stock enforcement inside the same transaction
--
-- ⚠️ BEFORE RUNNING: confirm the real schema (do not assume)
--   Run the STEP 0 queries first and check the output. In particular:
--     - `products.variants` may be jsonb, text[] or text. The function below
--       handles jsonb; if your column is text[] or text it must be adapted.
--     - `orders.id` must be a text/varchar column large enough for a UUID (36).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 0 - INSPECT FIRST (read-only). Paste the results into your review.
-- ----------------------------------------------------------------------------

-- Column types this migration depends on.
SELECT table_name, column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name IN ('products', 'orders')
  AND column_name IN ('id', 'stock', 'variants')
ORDER BY table_name, column_name;

-- Is `orders.id` unique? The idempotency guarantee depends on it.
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'orders' AND indexdef ILIKE '%(id)%';

-- Confirm nothing named reserve_stock already exists.
SELECT proname FROM pg_proc WHERE proname = 'reserve_stock';


-- ----------------------------------------------------------------------------
-- STEP 1 - the atomic reservation function (PASS 1: lock + validate)
-- Run ONLY after STEP 0 confirms `variants` is jsonb (or you have adapted it).
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reserve_stock(p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  line            jsonb;
  pid             text;
  qty             int;
  variant_name    text;
  current_stock   int;
  reserved        int := 0;
  failures        jsonb := '[]'::jsonb;
  updated_variants jsonb;
  design          jsonb;
  design_name     text;
  design_stock    int;
  new_designs     jsonb;
  i               int;
  n               int;
  matched         boolean;
BEGIN
  -- Lock every affected product row for the whole transaction. Concurrent
  -- callers queue here instead of interleaving; that is what removes the race.
  FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    pid          := line->>'product_id';
    qty          := COALESCE((line->>'quantity')::int, 0);
    variant_name := line->>'variant_name';

    CONTINUE WHEN pid IS NULL OR qty <= 0;

    SELECT stock, variants INTO current_stock, updated_variants
    FROM products WHERE id = pid FOR UPDATE;

    IF NOT FOUND THEN
      failures := failures || jsonb_build_array(jsonb_build_object(
        'product_id', pid, 'requested', qty, 'available', 0));
      CONTINUE;
    END IF;

    current_stock := COALESCE(current_stock, 0);

    -- Per-design enforcement when the customer chose a design.
    IF variant_name IS NOT NULL
       AND updated_variants IS NOT NULL
       AND jsonb_typeof(updated_variants) = 'array' THEN

      new_designs := '[]'::jsonb;
      n           := jsonb_array_length(updated_variants);
      matched     := false;

      FOR i IN 0..n - 1 LOOP
        design       := updated_variants -> i;
        design_name  := COALESCE(design->>'name', '');
        design_stock := COALESCE((design->>'stock')::int, current_stock);

        IF lower(btrim(design_name)) = lower(btrim(variant_name)) THEN
          matched := true;
          IF design_stock < qty THEN
            RETURN jsonb_build_object('ok', false, 'failures',
              failures || jsonb_build_array(jsonb_build_object(
                'product_id', pid, 'requested', qty, 'available', design_stock)));
          END IF;
          design := jsonb_set(design, '{stock}', to_jsonb(design_stock - qty));
        END IF;

        new_designs := new_designs || jsonb_build_array(design);
      END LOOP;

      IF NOT matched THEN
        RETURN jsonb_build_object('ok', false, 'failures',
          failures || jsonb_build_array(jsonb_build_object(
            'product_id', pid, 'requested', qty, 'available', 0)));
      END IF;

      updated_variants := new_designs;
    END IF;

    IF current_stock < qty THEN
      RETURN jsonb_build_object('ok', false, 'failures',
        failures || jsonb_build_array(jsonb_build_object(
          'product_id', pid, 'requested', qty, 'available', current_stock)));
    END IF;

    reserved := reserved + qty;
  END LOOP;

  IF jsonb_array_length(failures) > 0 THEN
    -- Nothing was written: we return before any UPDATE runs.
    RETURN jsonb_build_object('ok', false, 'failures', failures);
  END IF;

  -- Every line validated. Apply the decrements while still holding the locks.
  FOR line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    pid          := line->>'product_id';
    qty          := COALESCE((line->>'quantity')::int, 0);
    variant_name := line->>'variant_name';

    CONTINUE WHEN pid IS NULL OR qty <= 0;

    IF variant_name IS NOT NULL THEN
      SELECT variants INTO updated_variants FROM products WHERE id = pid FOR UPDATE;

      IF updated_variants IS NOT NULL
         AND jsonb_typeof(updated_variants) = 'array' THEN
        new_designs := '[]'::jsonb;
        n := jsonb_array_length(updated_variants);

        FOR i IN 0..n - 1 LOOP
          design       := updated_variants -> i;
          design_name  := COALESCE(design->>'name', '');
          design_stock := COALESCE((design->>'stock')::int, 0);

          IF lower(btrim(design_name)) = lower(btrim(variant_name)) THEN
            design := jsonb_set(design, '{stock}',
              to_jsonb(GREATEST(design_stock - qty, 0)));
          END IF;

          new_designs := new_designs || jsonb_build_array(design);
        END LOOP;

        UPDATE products
        SET variants = new_designs,
            stock = GREATEST(stock - qty, 0),
            updated_at = now()
        WHERE id = pid;
      ELSE
        UPDATE products
        SET stock = GREATEST(stock - qty, 0), updated_at = now()
        WHERE id = pid;
      END IF;
    ELSE
      UPDATE products
      SET stock = GREATEST(stock - qty, 0), updated_at = now()
      WHERE id = pid;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'failures', '[]'::jsonb, 'reserved', reserved);
END;
$$;

-- The application calls this with the service key, which bypasses RLS, so the
-- grant is deliberately narrow.
REVOKE ALL ON FUNCTION public.reserve_stock(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_stock(jsonb) TO service_role;


-- ----------------------------------------------------------------------------
-- STEP 2 - indexes (run only after reviewing the STEP 0 output)
--
-- CREATE INDEX IF NOT EXISTS makes re-running a no-op, so these cannot create
-- duplicates. Do not run this if your project already has equivalent indexes
-- under different names - check STEP 0 first.
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);


-- ----------------------------------------------------------------------------
-- STEP 3 - verification (read-only)
-- ----------------------------------------------------------------------------

SELECT proname FROM pg_proc WHERE proname = 'reserve_stock';

SELECT indexname FROM pg_indexes
WHERE indexname IN ('idx_orders_created_at', 'idx_orders_status',
                    'idx_products_category', 'idx_products_created_at');

-- STAGING ONLY manual check: set a product to exactly 1 unit and confirm the
-- second reservation is refused.
--
--   UPDATE products SET stock = 1 WHERE id = '<a-test-product>';
--   SELECT public.reserve_stock('[{"product_id":"<id>","quantity":1}]'::jsonb);
--   SELECT public.reserve_stock('[{"product_id":"<id>","quantity":1}]'::jsonb);
--   -- the second call must return {"ok": false, ...}
--
-- That proves sequential behaviour. The real concurrency proof is the k6
-- checkout-flood scenario (T6) in LOAD_TEST_PLAN.md, against staging only.
