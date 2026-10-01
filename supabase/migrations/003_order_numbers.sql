-- ============================================================================
-- HEROIX - customer-facing order numbers  (MIGRATION 003)
--
-- STATUS: PREPARED, NOT APPLIED. Requires owner approval before running.
--
-- WHAT THIS ADDS
--   orders.order_number - a short, human-readable number (1001, 1002, ...)
--   shown to customers on WhatsApp and in the admin dashboard.
--
-- WHY
-- Orders are keyed internally by a UUID, which is what the idempotency logic
-- depends on. That UUID is useless to a human reading it out over the phone to
-- send a payment screenshot. This adds a separate display number and leaves the
-- UUID completely untouched.
--
-- THE SECURITY REASON THE NUMBER IS NEVER A LOOKUP KEY
-- orders.id stays the primary key and stays random. order_number is sequential,
-- so it is trivially guessable - which is why nothing may look an order up by
-- it. The admin dashboard's edit and delete buttons must keep sending the UUID.
-- If a future change ever routes a lookup through order_number, anyone could
-- enumerate 1001, 1002, ... and read other customers' names, phones and
-- addresses. order_number is for display only.
--
-- PRE-FLIGHT
-- 1. Deploy the code that reads/writes order_number BEFORE running this, or the
--    column simply stays NULL and the dashboard shows a placeholder. The column
--    is added nullable so nothing breaks in either order.
-- 2. Run:  node scripts/migration-preflight.mjs
--
-- This script only ever ADDS a column and writes display numbers. It contains
-- no DELETE, TRUNCATE, DROP TABLE or ALTER COLUMN TYPE.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- STEP 1 - add the column (safe to re-run)
-- ----------------------------------------------------------------------------

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number integer;

-- Existing rows get numbers after the step below, so this backfill is not needed
-- before adding the constraint.


-- ----------------------------------------------------------------------------
-- STEP 2 - backfill existing orders, oldest first
-- ----------------------------------------------------------------------------
-- Only assigns numbers where there is none, so re-running cannot renumber
-- orders that already have one. The starting value is 1001.

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

-- Backfill guard: if this returns any rows, the counter would collide below.
SELECT id, order_number FROM orders
WHERE order_number IS NOT NULL
ORDER BY order_number;


-- ----------------------------------------------------------------------------
-- STEP 3 - enforce uniqueness
-- ----------------------------------------------------------------------------
-- Guarantees two orders can never share a customer-facing number. The unique
-- index is what makes the "insert, and retry with the next number on collision"
-- logic in lib/orders-store.ts safe under concurrent checkouts.

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key
  ON orders (order_number)
  WHERE order_number IS NOT NULL;


-- ----------------------------------------------------------------------------
-- STEP 4 - verification (read-only, safe to run any time)
-- ----------------------------------------------------------------------------

-- Expect every row numbered, and no duplicates.
SELECT order_number, COUNT(*) AS rows_with_this_number
FROM orders
WHERE order_number IS NOT NULL
GROUP BY order_number
HAVING COUNT(*) > 1;          -- expect ZERO rows

SELECT COUNT(*) AS unnumbered_orders
FROM orders
WHERE order_number IS NULL;   -- expect 0

-- A sample of what customers will now see.
SELECT order_number, id, customer, total, created_at
FROM orders
ORDER BY order_number
LIMIT 10;

-- The unique index must exist.
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'orders' AND indexname = 'orders_order_number_key';
